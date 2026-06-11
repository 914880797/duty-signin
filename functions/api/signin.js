export async function onRequestPost({ request, env }) {
  try {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    
    // 获取北京时间
    const now = new Date();
    const bjTimestamp = now.getTime() + (8 * 60 * 60 * 1000);
    const bjDate = new Date(bjTimestamp);
    
    const pad = (n) => String(n).padStart(2, '0');
    const today = `${bjDate.getUTCFullYear()}-${pad(bjDate.getUTCMonth() + 1)}-${pad(bjDate.getUTCDate())}`;
    const currentTime = `${pad(bjDate.getUTCHours())}:${pad(bjDate.getUTCMinutes())}`;
    const created_at = `${today} ${pad(bjDate.getUTCHours())}:${pad(bjDate.getUTCMinutes())}:${pad(bjDate.getUTCSeconds())}`;

    // 解析请求 body
    const json = await request.json();
    const name = json.name;
    const clientTime = json.current_time;
    const finalTime = clientTime || currentTime;
    
    // 参数验证
    if (!name || !name.trim()) {
      return Response.json({ error: '姓名不能为空' }, { status: 400 });
    }
    
    const trimmedName = name.trim();

    // 查询排班：放宽到从前天开始的排班（处理凌晨时段）
    const twoDaysAgo = new Date(bjTimestamp - (2 * 24 * 60 * 60 * 1000));
    const twoDaysAgoStr = `${twoDaysAgo.getUTCFullYear()}-${pad(twoDaysAgo.getUTCMonth() + 1)}-${pad(twoDaysAgo.getUTCDate())}`;
    
    const dutyConfig = await env.DB.prepare(`
      SELECT name, duty_time, duty_date, group_id FROM duty_config
      WHERE name = ? AND duty_date >= ?
      ORDER BY duty_date ASC
      LIMIT 1
    `).bind(trimmedName, twoDaysAgoStr).first();
    
    if (!dutyConfig || !dutyConfig.duty_time || dutyConfig.duty_time === '未安排') {
      return Response.json(
        { error: `未参与值班，请联系管理员添加排班` },
        { status: 403 }
      );
    }
    
    const personDutyTime = dutyConfig.duty_time;
    
    // 时间验证
    let currentTimeInMinutes = parseInt(finalTime.split(':')[0]) * 60 + parseInt(finalTime.split(':')[1]);
    const dutyRange = getDutyTimeRange(personDutyTime);
    
    if (dutyRange) {
      // 处理跨天时段：如果当前时间 < 6:00 且是跨天时段，给当前时间加 24 小时
      if (dutyRange.isOvernight && currentTimeInMinutes < 6 * 60) {
        currentTimeInMinutes += 24 * 60;
      }
      
      const isValid = currentTimeInMinutes >= dutyRange.startTime && currentTimeInMinutes <= dutyRange.endTime;
      
      if (!isValid) {
        return Response.json({ 
          error: `你的值班时间是 ${personDutyTime}，请在值班时间内打卡`,
          duty_time: personDutyTime,
          current_time: finalTime
        }, { status: 400 });
      }
    }
    
    // 重复打卡检查：使用排班日期而非今天（对于凌晨时段很重要）
    const recentCheck = await env.DB.prepare(`
      SELECT created_at FROM signin_records 
      WHERE name = ? AND duty_date = ? AND duty_time = ?
      ORDER BY created_at DESC LIMIT 1
    `).bind(trimmedName, dutyConfig.duty_date, personDutyTime).first();

    if (recentCheck) {
      return Response.json(
        { error: `今天已经打过卡了，每个时段每天只能打卡一次` },
        { status: 400 }
      );
    }
    
    // 插入打卡记录
    await env.DB.prepare(`
      INSERT INTO signin_records (name, duty_date, duty_time, group_id, created_at, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(trimmedName, dutyConfig.duty_date, personDutyTime, dutyConfig.group_id || null, created_at, ip).run();

    return Response.json({ 
      ok: true, 
      date: today, 
      time: created_at,
      duty_time: personDutyTime
    });
  } catch (e) {
    console.error('Signin error:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

function getDutyTimeRange(dutyTime) {
  if (!dutyTime || dutyTime === '未安排') return null;
  
  const match = dutyTime.match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/);
  if (!match) {
    return null;
  }
  
  let [, startHour, startMin, endHour, endMin] = match.map(Number);
  
  // 处理 24:00 的情况（表示午夜 00:00）
  const originalStartHour = startHour;
  if (startHour === 24) {
    startHour = 0;
  }
  if (endHour === 24) {
    endHour = 0;
  }
  
  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;
  
  // 跨天定义：原始开始时间大于结束时间（如 23:00-04:00）
  // 注意：24:00-04:00 转换成 00:00-04:00 后，0 < 240，不是跨天
  const isOvernight = originalStartHour > endHour && originalStartHour !== 24;
  
  return {
    startTime: startTime,
    endTime: endTime,
    name: dutyTime,
    isOvernight: isOvernight
  };
}
