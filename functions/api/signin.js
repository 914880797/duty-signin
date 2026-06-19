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
    
    // 获取今天、昨天、明天的所有排班（duty_config 显式排班）
    const allConfigs = await env.DB.prepare(`
      SELECT name, duty_time, duty_date, group_id FROM duty_config
      WHERE name = ? AND duty_date IN (?, ?, ?)
      ORDER BY duty_date, duty_time
    `).bind(trimmedName, yesterdayStr, today, tomorrowStr).all();

    // 补充 duty_bindings 永久基线（无日期，按当天日期注入）
    const bindings = await env.DB.prepare(`
      SELECT name, duty_time, group_id FROM duty_bindings WHERE name = ?
    `).bind(trimmedName).all();

    // 获取有效的时段列表（管理员在时段配置中定义的）
    const validTimesSetting = await env.DB.prepare(`
      SELECT value FROM settings WHERE key = 'valid_duty_times'
    `).first();
    const validDutyTimes = validTimesSetting?.value ? JSON.parse(validTimesSetting.value) : null;

    if ((!allConfigs.results || allConfigs.results.length === 0) && (!bindings.results || bindings.results.length === 0)) {
        return Response.json(
            { error: `未参与值班，请联系管理员添加排班` },
            { status: 403 }
        );
    }

    // 将 bindings 转为与 config 同结构的结果，duty_date 使用当天日期
    // 并且过滤掉不在有效时段列表中的 historical 记录
    const bindingConfigs = (bindings.results || [])
      .filter(b => !validDutyTimes || validDutyTimes.includes(b.duty_time))
      .map(b => ({
      name: b.name,
      duty_time: b.duty_time,
      duty_date: today,
      group_id: b.group_id
    }));

    // 合并：config 优先（精确日期），bindings 补充（当天日期）
    const combinedResults = [...(allConfigs.results || [])];
    for (const bc of bindingConfigs) {
      const exists = combinedResults.some(r =>
        r.name === bc.name && r.duty_time === bc.duty_time && r.duty_date === bc.duty_date
      );
      if (!exists) combinedResults.push(bc);
    }

    const datePriority = { [today]: 0, [tomorrowStr]: 1, [yesterdayStr]: 2 };
    combinedResults.sort((a, b) => {
      const pa = datePriority[a.duty_date] ?? 3;
      const pb = datePriority[b.duty_date] ?? 3;
      if (pa !== pb) return pa - pb;
      if (a.duty_time !== b.duty_time) return a.duty_time < b.duty_time ? -1 : 1;
      return 0;
    });

    // 找到当前时间所在的值班时段
    let dutyConfig = null;
    let currentTimeInMinutes = parseInt(finalTime.split(':')[0]) * 60 + parseInt(finalTime.split(':')[1]);
    const dayInMinutes = 24 * 60;
    
    for (const config of combinedResults) {
        const range = getDutyTimeRange(config.duty_time);
        if (!range) continue;
        
        const configDate = config.duty_date;
        
        // 判断跨天时段需要扩展比较
        let adjustedTime = currentTimeInMinutes;
        let adjustedStart = range.startTime;
        let adjustedEnd = range.endTime;
        
        if (range.isOvernight) {
            // 对于跨天时段（如 23:00-04:00），比较逻辑：
            // 如果当前时间在 00:00-endTime 之间，说明是跨天后的时间
            // 将当前时间 + 24h，与 startTime~(endTime+24h) 比较
            if (currentTimeInMinutes <= range.endTime) {
                adjustedTime += dayInMinutes;
                adjustedEnd += dayInMinutes;
            } else if (currentTimeInMinutes >= range.startTime) {
                // 当前时间在 start~23:59，是跨天前的时间
                adjustedEnd += dayInMinutes;
            }
        }

        // 如果是昨天的排班且是跨天时段且当前是凌晨
        if (configDate === yesterdayStr && range.isOvernight && currentTimeInMinutes <= range.endTime) {
            adjustedTime += dayInMinutes;
            adjustedEnd += dayInMinutes;
        }
        
        if (adjustedTime >= adjustedStart && adjustedTime <= adjustedEnd) {
            dutyConfig = config;
            break;
        }
    }
    
    // 如果没有找到匹配的时段，用第一个（处理提前打卡）
    if (!dutyConfig) {
        dutyConfig = combinedResults[0];
    }

    // 00:00-07:59 时段属于前一天值班周期，签到日期改为前一天
    {
      const startMatch = dutyConfig.duty_time?.match(/(\d{2}):(\d{2})/);
      if (startMatch) {
        const startMin = parseInt(startMatch[1]) * 60 + parseInt(startMatch[2]);
        if (startMin >= 0 && startMin < 480) {
          const prevDay = new Date(bjTimestamp - (1 * 24 * 60 * 60 * 1000));
          dutyConfig.duty_date = `${prevDay.getUTCFullYear()}-${pad(prevDay.getUTCMonth() + 1)}-${pad(prevDay.getUTCDate())}`;
        }
      }
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
      // 处理跨天时段：动态扩展结束时间
      if (dutyRange.isOvernight && currentTimeInMinutes <= dutyRange.endTime) {
        currentTimeInMinutes += dayInMinutes;
      } else if (dutyRange.isOvernight) {
        dutyRange.endTime += dayInMinutes;
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
      success: true, 
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
