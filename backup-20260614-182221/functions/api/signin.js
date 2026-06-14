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

    // 查询排班：查询今天、昨天、明天的排班
    const yesterday = new Date(bjTimestamp - (1 * 24 * 60 * 60 * 1000));
    const yesterdayStr = `${yesterday.getUTCFullYear()}-${pad(yesterday.getUTCMonth() + 1)}-${pad(yesterday.getUTCDate())}`;
    const tomorrow = new Date(bjTimestamp + (1 * 24 * 60 * 60 * 1000));
    const tomorrowStr = `${tomorrow.getUTCFullYear()}-${pad(tomorrow.getUTCMonth() + 1)}-${pad(tomorrow.getUTCDate())}`;
    
    // 获取今天、昨天、明天的所有排班
    const allConfigs = await env.DB.prepare(`
      SELECT name, duty_time, duty_date, group_id FROM duty_config
      WHERE name = ? AND duty_date IN (?, ?, ?)
      ORDER BY duty_date, duty_time
    `).bind(trimmedName, yesterdayStr, today, tomorrowStr).all();
    
    if (!allConfigs.results || allConfigs.results.length === 0) {
        return Response.json(
            { error: `未参与值班，请联系管理员添加排班` },
            { status: 403 }
        );
    }
    
    // 找到当前时间所在的值班时段
    let dutyConfig = null;
    let currentTimeInMinutes = parseInt(finalTime.split(':')[0]) * 60 + parseInt(finalTime.split(':')[1]);
    
    for (const config of allConfigs.results) {
        const range = getDutyTimeRange(config.duty_time);
        if (!range) continue;
        
        // 处理跨天：如果是昨天排班且当前是午夜前，或今天排班且当前是凌晨
        let adjustedTime = currentTimeInMinutes;
        const configDate = config.duty_date;
        
        // 如果是昨天的排班且是跨天到凌晨的时段（如 23:00-04:00），当前时间加 24 小时比较
        if (configDate === yesterdayStr && range.isOvernight && currentTimeInMinutes < 6 * 60) {
            adjustedTime += 24 * 60;
        }
        // 如果是跨天时段且当前时间 < 6:00，给当前时间加 24 小时
        if (range.isOvernight && currentTimeInMinutes < 6 * 60) {
            adjustedTime += 24 * 60;
        }
        
        if (adjustedTime >= range.startTime && adjustedTime <= range.endTime) {
            dutyConfig = config;
            break;
        }
    }
    
    // 如果没有找到匹配的时段，用第一个（处理提前打卡）
    if (!dutyConfig) {
        dutyConfig = allConfigs.results[0];
    }
    
    if (!dutyConfig.duty_time || dutyConfig.duty_time === '未安排') {
      return Response.json(
        { error: `未参与值班，请联系管理员添加排班` },
        { status: 403 }
      );
    }
    
    const personDutyTime = dutyConfig.duty_time;
    
    // 时间验证
    const dutyRange = getDutyTimeRange(dutyConfig.duty_time);
    
    console.log('打卡验证:', {
        name: trimmedName,
        duty_time: dutyConfig.duty_time,
        duty_date: dutyConfig.duty_date,
        current_time: finalTime,
        currentTimeInMinutes: currentTimeInMinutes,
        dutyRange: dutyRange
    });
    
    if (dutyRange) {
      // 处理跨天时段：如果当前时间 < 6:00 且是跨天时段，给当前时间加 24 小时
      if (dutyRange.isOvernight && currentTimeInMinutes < 6 * 60) {
        currentTimeInMinutes += 24 * 60; // 只加 1 天，不是 2 天
      }
      
      const isValid = currentTimeInMinutes >= dutyRange.startTime && currentTimeInMinutes <= dutyRange.endTime;
      
      console.log('验证结果:', {
        isValid,
        startTime: dutyRange.startTime,
        endTime: dutyRange.endTime,
        currentTimeInMinutes
      });
      
      if (!isValid) {
        return Response.json({ 
          error: `你的值班时间是 ${dutyConfig.duty_time}，请在值班时间内打卡`,
          duty_time: dutyConfig.duty_time,
          current_time: finalTime
        }, { status: 400 });
      }
    }
    
    // 重复打卡检查：使用排班日期和排班时间
    const recentCheck = await env.DB.prepare(`
      SELECT created_at FROM signin_records 
      WHERE name = ? AND duty_date = ? AND duty_time = ?
      ORDER BY created_at DESC LIMIT 1
    `).bind(trimmedName, dutyConfig.duty_date, dutyConfig.duty_time).first();

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
    `).bind(trimmedName, dutyConfig.duty_date, dutyConfig.duty_time, dutyConfig.group_id || null, created_at, ip).run();

    return Response.json({ 
      ok: true, 
      date: dutyConfig.duty_date, 
      time: created_at,
      duty_time: dutyConfig.duty_time
    });
  } catch (e) {
    console.error('Signin error:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

function getDutyTimeRange(dutyTime) {
  if (!dutyTime || dutyTime === '未安排') return null;
  
  // 移除所有空格，处理 "04 :00-06: 00" 这种情况
  const cleanTime = dutyTime.replace(/\s+/g, '');
  
  const match = cleanTime.match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/);
  if (!match) {
    return null;
  }
  
  let [, startHour, startMin, endHour, endMin] = match.map(Number);
  
  // 记录原始开始时间用于判断跨天
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
  const isOvernight = originalStartHour > endHour && originalStartHour !== 24;
  
  return {
    startTime: startTime,
    endTime: endTime,
    name: cleanTime,
    isOvernight: isOvernight
  };
}
