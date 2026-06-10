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

    console.log('=== 打卡请求开始 ===');
    console.log('UTC 时间戳:', utcTimestamp);
    console.log('北京时间戳:', bjTimestamp);
    console.log('解析后的日期:', today);
    console.log('解析后的时间:', currentTime);

    const { name, duty_time, current_time: clientTime } = await request.json();

    // 优先使用前端传来的时间，如果没有则使用后端计算的时间
    const finalTime = clientTime || currentTime;
    console.log('使用时间:', finalTime, clientTime ? '(前端)' : '(后端)');

    // 参数验证
    if (!name || !name.trim()) {
      return Response.json(
        { error: '姓名不能为空' },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();

    // 查询排班表中此人的所有值班时段（不限日期，只看今天或未来的日期）
    let dutyConfig;
    try {
      // 查询今天及未来的排班
      dutyConfig = await env.DB.prepare(`
        SELECT name, duty_time, duty_date FROM duty_config
        WHERE name = ? AND duty_date >= ?
        ORDER BY duty_date ASC
        LIMIT 1
      `).bind(trimmedName, today).first();
      
      console.log('数据库查询成功');
      console.log('查询结果:', dutyConfig);
    } catch (dbError) {
      console.error('数据库查询失败:', dbError);
      return Response.json(
        { error: '数据库错误：' + dbError.message },
        { status: 500 }
      );
    }
    
    // 检查是否找到有效的排班
    if (!dutyConfig || !dutyConfig.duty_time) {
      console.log('错误：该用户没有未来的排班记录');
      return Response.json(
        { error: `未参与值班，请联系管理员添加排班` },
        { status: 403 }
      );
    }
    
    const personDutyTime = dutyConfig.duty_time;
    console.log('此人排班时段:', personDutyTime);
    console.log('排班日期:', dutyConfig.duty_date);
    
    if (!personDutyTime) {
      console.log('错误：排班时段为空');
      return Response.json(
        { error: `(夜班) 非值班人员无法打卡` },
        { status: 403 }
      );
    }

    // 验证当前时间是否在值班时间段内
    const currentDutyPeriod = getCurrentDutyPeriod(finalTime);
    const personDutyPeriod = getDutyTimeRange(personDutyTime);
    
    console.log('验证时间:', finalTime);
    console.log('当前时间分钟数:', currentDutyPeriod ? currentDutyPeriod.startTime + '-' + currentDutyPeriod.endTime : 'null');
    console.log('值班时段:', personDutyTime);
    console.log('值班时段分钟数:', personDutyPeriod ? personDutyPeriod.startTime + '-' + personDutyPeriod.endTime : 'null');
    
    if (personDutyPeriod && currentDutyPeriod) {
      const isWithinTimeRange = (
        currentDutyPeriod.startTime >= personDutyPeriod.startTime &&
        currentDutyPeriod.endTime <= personDutyPeriod.endTime
      );
      
      console.log('时间验证结果:', isWithinTimeRange);
      console.log('条件 1 - 当前开始 >= 值班开始:', currentDutyPeriod.startTime >= personDutyPeriod.startTime);
      console.log('条件 2 - 当前结束 <= 值班结束:', currentDutyPeriod.endTime <= personDutyPeriod.endTime);
      
      if (!isWithinTimeRange) {
        return Response.json(
          { 
            error: `你的值班时间是 ${personDutyTime}，请在值班时间内打卡`,
            duty_time: personDutyTime,
            current_time: finalTime
          },
          { status: 400 }
        );
      }
    } else {
      console.log('验证失败：personDutyPeriod 或 currentDutyPeriod 为空');
    }

    // 检查今天是否已经打过卡（同一天同一个时段只能打一次）
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

    // 插入打卡记录（使用排班表中的日期）
    await env.DB.prepare(`
      INSERT INTO signin_records (name, duty_date, duty_time, created_at, ip_address)
      VALUES (?, ?, ?, ?, ?)
    `).bind(trimmedName, dutyConfig.duty_date, personDutyTime, created_at, ip).run();

    console.log('=== 打卡成功 ===');
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

// 根据 HH:MM 时间获取对应的值班时段范围
function getCurrentDutyPeriod(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const timeInMinutes = hours * 60 + minutes;
  
  console.log('getCurrentDutyPeriod 输入:', timeStr, '分钟数:', timeInMinutes);
  
  const shifts = [
    { start: 4 * 60, end: 6 * 60, name: '04:00-06:00' },
    { start: 6 * 60, end: 8 * 60, name: '06:00-08:00' },
    { start: 8 * 60, end: 9 * 60 + 30, name: '08:00-09:30' },
    { start: 9 * 60 + 30, end: 11 * 60, name: '09:30-11:00' },
    { start: 11 * 60, end: 12 * 60 + 30, name: '11:00-12:30' },
    { start: 12 * 60 + 30, end: 14 * 60, name: '12:30-14:00' },
    { start: 14 * 60, end: 15 * 60 + 30, name: '14:00-15:30' },
    { start: 15 * 60 + 30, end: 17 * 60, name: '15:30-17:00' },
    { start: 17 * 60, end: 18 * 60 + 30, name: '17:00-18:30' },
    { start: 18 * 60 + 30, end: 20 * 60, name: '18:30-20:00' },
    { start: 20 * 60, end: 21 * 60 + 30, name: '20:00-21:30' },
    { start: 21 * 60 + 30, end: 23 * 60, name: '21:30-23:00' },
    { start: 23 * 60, end: 24 * 60, name: '23:00-24:00' },
    { start: 0, end: 4 * 60, name: '24:00-04:00' }
  ];
  
  for (const shift of shifts) {
    const matched = timeInMinutes >= shift.start && timeInMinutes < shift.end;
    console.log('检查时段:', shift.name, `(${shift.start}-${shift.end})`, '匹配:', matched);
    if (matched) {
      console.log('匹配的时段:', shift);
      return shift;
    }
  }
  
  console.log('未匹配到任何时段');
  return null;
}

// 解析值班时间段（如 "20:00-21:30"）为开始和结束分钟数
function getDutyTimeRange(dutyTime) {
  if (!dutyTime || dutyTime === '未安排') {
    return null;
  }
  
  const match = dutyTime.match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/);
  if (!match) {
    return null;
  }
  
  const [, startHour, startMin, endHour, endMin] = match.map(Number);
  return {
    startTime: startHour * 60 + startMin,
    endTime: endHour * 60 + endMin,
    name: dutyTime
  };
}
