import { pad, todayBeijing, formatBeijingNow, getDutyTimeRange, DAY_MINUTES } from './_shared.js';

export async function onRequestPost({ request, env }) {
  try {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    const bjTimestamp = Date.now() + 8 * 60 * 60 * 1000;
    const bjDate = new Date(bjTimestamp);

    const today = todayBeijing();
    const currentTime = `${pad(bjDate.getUTCHours())}:${pad(bjDate.getUTCMinutes())}`;
    const created_at = formatBeijingNow();

    const json = await request.json();
    const name = json.name;
    const clientTime = json.current_time;
    const finalTime = clientTime || currentTime;

    if (!name || !name.trim()) {
      return Response.json({ error: '姓名不能为空' }, { status: 400 });
    }

    const trimmedName = name.trim();

    const yesterday = new Date(bjTimestamp - (1 * 24 * 60 * 60 * 1000));
    const yesterdayStr = `${yesterday.getUTCFullYear()}-${pad(yesterday.getUTCMonth() + 1)}-${pad(yesterday.getUTCDate())}`;
    const tomorrow = new Date(bjTimestamp + (1 * 24 * 60 * 60 * 1000));
    const tomorrowStr = `${tomorrow.getUTCFullYear()}-${pad(tomorrow.getUTCMonth() + 1)}-${pad(tomorrow.getUTCDate())}`;

    const allConfigs = await env.DB.prepare(`
      SELECT name, duty_time, duty_date, group_id FROM duty_config
      WHERE name = ? AND duty_date IN (?, ?, ?)
      ORDER BY duty_date, duty_time
    `).bind(trimmedName, yesterdayStr, today, tomorrowStr).all();

    const bindings = await env.DB.prepare(`
      SELECT name, duty_time, group_id FROM duty_bindings WHERE name = ?
    `).bind(trimmedName).all();

    const validTimesSetting = await env.DB.prepare(`
      SELECT value FROM settings WHERE key = 'valid_duty_times'
    `).first();
    const validDutyTimes = validTimesSetting?.value ? JSON.parse(validTimesSetting.value) : null;

    if ((!allConfigs.results || allConfigs.results.length === 0) && (!bindings.results || bindings.results.length === 0)) {
        return Response.json({ error: `未参与值班，请联系管理员添加排班` }, { status: 403 });
    }

    const bindingConfigs = (bindings.results || [])
      .filter(b => !validDutyTimes || validDutyTimes.includes(b.duty_time))
      .map(b => ({
        name: b.name,
        duty_time: b.duty_time,
        duty_date: today,
        group_id: b.group_id
      }));

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

    let dutyConfig = null;
    let currentTimeInMinutes = parseInt(finalTime.split(':')[0]) * 60 + parseInt(finalTime.split(':')[1]);

    for (const config of combinedResults) {
        const range = getDutyTimeRange(config.duty_time);
        if (!range) continue;

        let adjustedTime = currentTimeInMinutes;
        let adjustedStart = range.startTime;
        let adjustedEnd = range.endTime;

        if (range.isOvernight) {
            if (currentTimeInMinutes <= range.endTime) {
                adjustedTime += DAY_MINUTES;
                adjustedEnd += DAY_MINUTES;
            } else if (currentTimeInMinutes >= range.startTime) {
                adjustedEnd += DAY_MINUTES;
            }
        }

        if (config.duty_date === yesterdayStr && range.isOvernight && currentTimeInMinutes <= range.endTime) {
            adjustedTime += DAY_MINUTES;
            adjustedEnd += DAY_MINUTES;
        }

        if (adjustedTime >= adjustedStart && adjustedTime <= adjustedEnd) {
            dutyConfig = config;
            break;
        }
    }

    if (!dutyConfig) {
        dutyConfig = combinedResults[0];
    }

    // 00:00-07:59（含 24:00 写法）时段属于前一天值班周期，签到日期改为前一天
    {
      const startMatch = dutyConfig.duty_time?.match(/(\d{2}):(\d{2})/);
      if (startMatch) {
        const startHour = parseInt(startMatch[1]) % 24;
        const startMin = startHour * 60 + parseInt(startMatch[2]);
        if (startMin >= 0 && startMin < 480) {
          const prevDay = new Date(bjTimestamp - (1 * 24 * 60 * 60 * 1000));
          dutyConfig.duty_date = `${prevDay.getUTCFullYear()}-${pad(prevDay.getUTCMonth() + 1)}-${pad(prevDay.getUTCDate())}`;
        }
      }
    }

    if (!dutyConfig.duty_time || dutyConfig.duty_time === '未安排') {
      return Response.json({ error: `未参与值班，请联系管理员添加排班` }, { status: 403 });
    }

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
      if (dutyRange.isOvernight && currentTimeInMinutes <= dutyRange.endTime) {
        currentTimeInMinutes += DAY_MINUTES;
      } else if (dutyRange.isOvernight) {
        dutyRange.endTime += DAY_MINUTES;
      }

      const isValid = currentTimeInMinutes >= dutyRange.startTime && currentTimeInMinutes <= dutyRange.endTime;

      console.log('验证结果:', { isValid, startTime: dutyRange.startTime, endTime: dutyRange.endTime, currentTimeInMinutes });

      if (!isValid) {
        return Response.json({
          error: `你的值班时间是 ${dutyConfig.duty_time}，请在值班时间内打卡`,
          duty_time: dutyConfig.duty_time,
          current_time: finalTime
        }, { status: 400 });
      }
    }

    // 重复打卡检查
    const recentCheck = await env.DB.prepare(`
      SELECT created_at FROM signin_records 
      WHERE name = ? AND duty_date = ? AND duty_time = ?
      ORDER BY created_at DESC LIMIT 1
    `).bind(trimmedName, dutyConfig.duty_date, dutyConfig.duty_time).first();

    if (recentCheck) {
      return Response.json({ error: `今天已经打过卡了，每个时段每天只能打卡一次` }, { status: 400 });
    }

    try {
      await env.DB.prepare(`
        INSERT INTO signin_records (name, duty_date, duty_time, group_id, created_at, ip_address, record_type)
        VALUES (?, ?, ?, ?, ?, ?, 'signin')
      `).bind(trimmedName, dutyConfig.duty_date, dutyConfig.duty_time, dutyConfig.group_id || null, created_at, ip).run();
    } catch (e) {
      if (e.message.includes('no column named record_type') || e.message.includes('no column: record_type')) {
        await env.DB.prepare(`
          INSERT INTO signin_records (name, duty_date, duty_time, group_id, created_at, ip_address)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(trimmedName, dutyConfig.duty_date, dutyConfig.duty_time, dutyConfig.group_id || null, created_at, ip).run();
      } else {
        throw e;
      }
    }

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
