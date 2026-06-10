export async function onRequestPost({ request, env }) {
  try {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    
    // 获取 UTC 时间，然后手动加上 8 小时得到北京时间
    const now = new Date();
    const utcTimestamp = now.getTime();
    const bjTimestamp = utcTimestamp + (8 * 60 * 60 * 1000);
    const bjDate = new Date(bjTimestamp);
    
    const pad = (n) => String(n).padStart(2, '0');
    const today = `${bjDate.getUTCFullYear()}-${pad(bjDate.getUTCMonth() + 1)}-${pad(bjDate.getUTCDate())}`;
    const currentTime = `${pad(bjDate.getUTCHours())}:${pad(bjDate.getUTCMinutes())}`;
    const created_at = `${today} ${pad(bjDate.getUTCHours())}:${pad(bjDate.getUTCMinutes())}:${pad(bjDate.getUTCSeconds())}`;

    // 解析请求 body
    const json = await request.json();
    const name = json.name;
    const clientTime = json.current_time;
    
    // 优先使用前端传来的时间
    const finalTime = clientTime || currentTime;
    
    // 参数验证
    if (!name || !name.trim()) {
      return Response.json({ error: '姓名不能为空' }, { status: 400 });
    }
    
    const trimmedName = name.trim();

    // 查询排班（包含 group_id）
    const dutyConfig = await env.DB.prepare(`
      SELECT name, duty_time, duty_date, group_id FROM duty_config
      WHERE name = ? AND duty_date >= ?
      ORDER BY duty_date ASC
      LIMIT 1
    `).bind(trimmedName, today).first();
    
    if (!dutyConfig || !dutyConfig.duty_time) {
      return Response.json(
        { error: `未参与值班，请联系管理员添加排班` },
        { status: 403 }
      );
    }
    
    const personDutyTime = dutyConfig.duty_time;
    
    // 验证当前时间是否在值班时间段内
    const timeMatch = getCurrentDutyPeriod(finalTime);
    const dutyRange = getDutyTimeRange(personDutyTime);
    
    if (dutyRange && timeMatch) {
      const isValid = timeMatch.startTime >= dutyRange.startTime && 
                      timeMatch.endTime <= dutyRange.endTime;
      
      if (!isValid) {
        return Response.json({ 
          error: `你的值班时间是 ${personDutyTime}，请在值班时间内打卡`,
          duty_time: personDutyTime,
          current_time: finalTime
        }, { status: 400 });
      }
    }

    // 检查今天是否已经打过卡
    const recentCheck = await env.DB.prepare(`
      SELECT created_at FROM signin_records 
      WHERE name = ? AND duty_date = ? AND duty_time = ?
      ORDER BY created_at DESC LIMIT 1
    `).bind(trimmedName, today, personDutyTime).first();

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

function getCurrentDutyPeriod(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  
  const parts = timeStr.split(':');
  if (parts.length !== 2) return null;
  
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  
  const timeInMinutes = hours * 60 + minutes;
  
  // 04:00-06:00
  if (timeInMinutes >= 4 * 60 && timeInMinutes < 6 * 60) 
    return { startTime: 4 * 60, endTime: 6 * 60 };
  // 06:00-08:00
  if (timeInMinutes >= 6 * 60 && timeInMinutes < 8 * 60) 
    return { startTime: 6 * 60, endTime: 8 * 60 };
  // 08:00-09:30
  if (timeInMinutes >= 8 * 60 && timeInMinutes < 9 * 60 + 30) 
    return { startTime: 8 * 60, endTime: 9 * 60 + 30 };
  // 09:30-11:00
  if (timeInMinutes >= 9 * 60 + 30 && timeInMinutes < 11 * 60) 
    return { startTime: 9 * 60 + 30, endTime: 11 * 60 };
  // 11:00-12:30
  if (timeInMinutes >= 11 * 60 && timeInMinutes < 12 * 60 + 30) 
    return { startTime: 11 * 60, endTime: 12 * 60 + 30 };
  // 12:30-14:00
  if (timeInMinutes >= 12 * 60 + 30 && timeInMinutes < 14 * 60) 
    return { startTime: 12 * 60 + 30, endTime: 14 * 60 };
  // 14:00-15:30
  if (timeInMinutes >= 14 * 60 && timeInMinutes < 15 * 60 + 30) 
    return { startTime: 14 * 60, endTime: 15 * 60 + 30 };
  // 15:30-17:00
  if (timeInMinutes >= 15 * 60 + 30 && timeInMinutes < 17 * 60) 
    return { startTime: 15 * 60 + 30, endTime: 17 * 60 };
  // 17:00-18:30
  if (timeInMinutes >= 17 * 60 && timeInMinutes < 18 * 60 + 30) 
    return { startTime: 17 * 60, endTime: 18 * 60 + 30 };
  // 18:30-20:00
  if (timeInMinutes >= 18 * 60 + 30 && timeInMinutes < 20 * 60) 
    return { startTime: 18 * 60 + 30, endTime: 20 * 60 };
  // 20:00-21:30
  if (timeInMinutes >= 20 * 60 && timeInMinutes < 21 * 60 + 30) 
    return { startTime: 20 * 60, endTime: 21 * 60 + 30 };
  // 21:30-23:00
  if (timeInMinutes >= 21 * 60 + 30 && timeInMinutes < 23 * 60) 
    return { startTime: 21 * 60 + 30, endTime: 23 * 60 };
  // 23:00-24:00
  if (timeInMinutes >= 23 * 60 && timeInMinutes < 24 * 60) 
    return { startTime: 23 * 60, endTime: 24 * 60 };
  // 24:00-04:00 (跨天)
  if (timeInMinutes >= 0 && timeInMinutes < 4 * 60) 
    return { startTime: 0, endTime: 4 * 60 };
  
  return null;
}

function getDutyTimeRange(dutyTime) {
  if (!dutyTime || dutyTime === '未安排') return null;
  
  const match = dutyTime.match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/);
  if (!match) return null;
  
  const [, startHour, startMin, endHour, endMin] = match.map(Number);
  return {
    startTime: startHour * 60 + startMin,
    endTime: endHour * 60 + endMin,
    name: dutyTime
  };
}
