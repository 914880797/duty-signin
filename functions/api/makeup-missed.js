export async function onRequestGet({ request, env }) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const nameFilter = searchParams.get('name');
  const groupIdFilter = searchParams.get('group_id');

  if (!startDate || !endDate) {
    return Response.json({ success: false, error: 'start_date and end_date are required' }, { status: 400 });
  }

  let dcWhere = `dc.duty_date >= ? AND dc.duty_date <= ? AND dc.duty_time IS NOT NULL AND dc.duty_time != '' AND dc.duty_time != '未安排'`;
  const dcArgs = [startDate, endDate];
  if (nameFilter) { dcWhere += ' AND dc.name LIKE ?'; dcArgs.push('%' + nameFilter + '%'); }
  if (groupIdFilter) { dcWhere += ' AND dc.group_id = ?'; dcArgs.push(groupIdFilter); }

  let signinWhere = `sr.duty_date >= ? AND sr.duty_date <= ?`;
  const signinArgs = [startDate, endDate];
  if (nameFilter) { signinWhere += ' AND sr.name LIKE ?'; signinArgs.push('%' + nameFilter + '%'); }

  let bindingWhere = '1=1';
  const bindingArgs = [];
  if (nameFilter) { bindingWhere += ' AND db.name LIKE ?'; bindingArgs.push('%' + nameFilter + '%'); }
  if (groupIdFilter) { bindingWhere += ' AND db.group_id = ?'; bindingArgs.push(groupIdFilter); }

  try {
    const [{ results: dcRows }, { results: signinRows }, { results: bindingRows }, validTimesSetting] = await Promise.all([
      env.DB.prepare(`SELECT dc.duty_date, dc.duty_time, dc.name, dc.group_id, sg.name as group_name FROM duty_config dc LEFT JOIN shift_groups sg ON dc.group_id = sg.id WHERE ${dcWhere}`).bind(...dcArgs).all(),
      env.DB.prepare(`SELECT duty_date, duty_time, name FROM signin_records sr WHERE ${signinWhere}`).bind(...signinArgs).all(),
      env.DB.prepare(`SELECT db.duty_time, db.name, db.group_id, sg.name as group_name FROM duty_bindings db LEFT JOIN shift_groups sg ON db.group_id = sg.id WHERE ${bindingWhere}`).bind(...bindingArgs).all(),
      env.DB.prepare(`SELECT value FROM settings WHERE key = 'valid_duty_times'`).first()
    ]);

    const validDutyTimes = validTimesSetting?.value ? JSON.parse(validTimesSetting.value) : null;

    const dateList = generateDateList(startDate, endDate);
    const signinSet = new Set();
    for (const s of signinRows) {
      signinSet.add(`${s.duty_date}|${s.duty_time}|${s.name}`);
    }

    const configKeySet = new Set();
    for (const r of dcRows) {
      configKeySet.add(`${r.duty_date}|${r.duty_time}|${r.name}`);
    }

    const results = [];

    for (const r of dcRows) {
      if (!signinSet.has(`${r.duty_date}|${r.duty_time}|${r.name}`)) {
        results.push(r);
      }
    }

    for (const b of bindingRows) {
      if (validDutyTimes && !validDutyTimes.includes(b.duty_time)) continue;
      for (const d of dateList) {
        const key = `${d}|${b.duty_time}|${b.name}`;
        if (configKeySet.has(key)) continue;
        if (signinSet.has(key)) continue;
        results.push({
          duty_date: d,
          duty_time: b.duty_time,
          name: b.name,
          group_id: b.group_id,
          group_name: b.group_name
        });
      }
    }

    results.sort((a, b) => {
      if (a.duty_date !== b.duty_date) return a.duty_date > b.duty_date ? -1 : 1;
      if (a.duty_time !== b.duty_time) return a.duty_time > b.duty_time ? 1 : -1;
      if (a.name !== b.name) return a.name > b.name ? 1 : -1;
      return 0;
    });

    // 当天未结束的时段不显示为漏打卡（时段结束时间 > 当前时间）
    const nowBJ = getBeijingNowMinutes();
    const todayBJ = formatBeijingDate();
    const filtered = results.filter(r => {
      if (r.duty_date !== todayBJ) return true;
      const endMin = getDutyEndMinutes(r.duty_time);
      return endMin !== null && nowBJ >= endMin;
    });

    return Response.json({ success: true, data: filtered });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

function generateDateList(start, end) {
  const dates = [];
  let cur = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  while (cur <= endDate) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function getBeijingNowMinutes() {
  const now = new Date();
  const bj = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return bj.getUTCHours() * 60 + bj.getUTCMinutes();
}

function formatBeijingDate() {
  const now = new Date();
  const bj = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${bj.getUTCFullYear()}-${pad(bj.getUTCMonth() + 1)}-${pad(bj.getUTCDate())}`;
}

function getDutyEndMinutes(dutyTime) {
  if (!dutyTime) return null;
  const clean = dutyTime.replace(/\s+/g, '');
  const match = clean.match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/);
  if (!match) return null;
  const endHour = parseInt(match[3]);
  const endMin = parseInt(match[4]);
  return endHour * 60 + endMin;
}
