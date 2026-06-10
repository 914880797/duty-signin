export async function onRequestPost({ request, env }) {
  try {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const utc = new Date();
    const bjTimestamp = utc.getTime() + (8 * 60 * 60 * 1000);
    const bjTime = new Date(bjTimestamp);

    const pad = (n) => String(n).padStart(2, '0');
    const today = `${bjTime.getUTCFullYear()}-${pad(bjTime.getUTCMonth() + 1)}-${pad(bjTime.getUTCDate())}`;
    const created_at = `${today} ${pad(bjTime.getUTCHours())}:${pad(bjTime.getUTCMinutes())}:${pad(bjTime.getUTCSeconds())}`;
    const currentTime = `${pad(bjTime.getUTCHours())}:${pad(bjTime.getUTCMinutes())}`;

    const { name, duty_time } = await request.json();

    // 参数验证
    if (!name || !name.trim()) {
      return Response.json(
        { error: '姓名不能为空' },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();

    console.log('=== 打卡请求开始 ===');
    console.log('日期:', today);
    console.log('姓名:', trimmedName);

    // 直接从 duty_config 表查询当天排班数据
    let dutyConfig;
    try {
      dutyConfig = await env.DB.prepare(`
        SELECT name, duty_time FROM duty_config
        WHERE duty_date = ?
      `).bind(today).all();
      
      console.log('数据库查询成功');
      console.log('查询结果原始数据:', JSON.stringify(dutyConfig));
      console.log('查询结果条数:', dutyConfig.results ? dutyConfig.results.length : 0);
    } catch (dbError) {
      console.error('数据库查询失败:', dbError);
      return Response.json(
        { error: '数据库错误：' + dbError.message },
        { status: 500 }
      );
    }
    
    const dutyConfigMap = {};
    if (dutyConfig && dutyConfig.results && dutyConfig.results.length > 0) {
      dutyConfig.results.forEach(row => {
        console.log('排班记录:', row.name, '->', row.duty_time);
        if (row.name && row.duty_time) {
          dutyConfigMap[row.name] = row.duty_time;
        }
      });
    }
    
    console.log('排班映射对象:', JSON.stringify(dutyConfigMap));
    console.log('查找的姓名:', trimmedName);
    console.log('是否存在:', dutyConfigMap.hasOwnProperty(trimmedName));
    
    // 检查姓名是否有排班
    if (!dutyConfigMap.hasOwnProperty(trimmedName)) {
      console.log('错误：该用户不在今天的排班表中');
      return Response.json(
        { error: `未参与值班` },
        { status: 403 }
      );
    }

    // 获取此人的值班时段
    const personDutyTime = dutyConfigMap[trimmedName];
    console.log('此人排班时段:', personDutyTime);
    
    if (!personDutyTime) {
      console.log('错误：排班时段为空');
      return Response.json(
        { error: `(夜班) 非值班人员无法打卡` },
        { status: 403 }
      );
    }

    // 验证当前时间是否在值班时间段内
    const currentDutyPeriod = getCurrentDutyPeriod(currentTime);
    const personDutyPeriod = getDutyTimeRange(personDutyTime);
    
    if (personDutyPeriod && currentDutyPeriod) {
      const isWithinTimeRange = (
        currentDutyPeriod.startTime >= personDutyPeriod.startTime &&
        currentDutyPeriod.endTime <= personDutyPeriod.endTime
      );
      
      if (!isWithinTimeRange) {
        return Response.json(
          { 
            error: `你的值班时间是 ${personDutyTime}，请在值班时间内打卡`,
            duty_time: personDutyTime,
            current_time: currentTime
          },
          { status: 400 }
        );
      }
    }

    // 检查是否重复打卡
    const recentCheck = await env.DB.prepare(`
      SELECT created_at FROM signin_records 
      WHERE name = ? AND duty_date = ? AND duty_time = ?
      ORDER BY created_at DESC LIMIT 1
    `).bind(trimmedName, today, personDutyTime).first();

    if (recentCheck) {
      return Response.json(
        { error: `已打卡` },
        { status: 400 }
      );
    }

    // 插入打卡记录
    await env.DB.prepare(`
      INSERT INTO signin_records (name, duty_date, duty_time, created_at, ip_address)
      VALUES (?, ?, ?, ?, ?)
    `).bind(trimmedName, today, personDutyTime, created_at, ip).run();

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
    if (timeInMinutes >= shift.start && timeInMinutes < shift.end) {
      return shift;
    }
  }
  
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
