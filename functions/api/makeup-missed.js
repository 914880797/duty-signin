export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const startDate = url.searchParams.get('start_date');
  const endDate = url.searchParams.get('end_date');

  function buildDateRange(start, end) {
    const dates = [];
    if (!start) return dates;
    const s = new Date(start + 'T00:00:00Z');
    const e = end ? new Date(end + 'T00:00:00Z') : new Date();
    for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }

  try {
    const dateRange = buildDateRange(startDate, endDate);

    const filterName = url.searchParams.get('name');
    const filterGroup = url.searchParams.get('group_id');

    let args = [];
    let whereExtra = '';

    if (startDate) {
      whereExtra += ' AND dc.duty_date >= ?';
      args.push(startDate);
    }
    if (endDate) {
      whereExtra += ' AND dc.duty_date <= ?';
      args.push(endDate);
    }
    if (filterName) {
      whereExtra += ' AND dc.name LIKE ?';
      args.push('%' + filterName + '%');
    }
    if (filterGroup) {
      whereExtra += ' AND dc.group_id = ?';
      args.push(filterGroup);
    }

    // 1. dated duty_config missed records
    const configResults = await env.DB.prepare(`
      SELECT dc.duty_date, dc.duty_time, dc.name, dc.group_id, sg.name as group_name
      FROM duty_config dc
      LEFT JOIN signin_records sr ON dc.name = sr.name AND dc.duty_date = sr.duty_date AND dc.duty_time = sr.duty_time
      LEFT JOIN shift_groups sg ON dc.group_id = sg.id
      WHERE sr.id IS NULL
        AND dc.duty_time IS NOT NULL AND dc.duty_time != '' AND dc.duty_time != '未安排'
        ${whereExtra}
      ORDER BY dc.duty_date DESC, dc.duty_time, dc.name
    `).bind(...args).all();

    const missed = configResults.results || [];

    // 2. permanent duty_bindings - check each binding against each date in range
    if (dateRange.length > 0) {
      let bindWhere = '';
      const bindArgs = [];

      if (filterName) {
        bindWhere += ' AND b.name LIKE ?';
        bindArgs.push('%' + filterName + '%');
      }
      if (filterGroup) {
        bindWhere += ' AND b.group_id = ?';
        bindArgs.push(filterGroup);
      }

      const bindingsResult = await env.DB.prepare(`
        SELECT b.duty_time, b.name, b.group_id, sg.name as group_name
        FROM duty_bindings b
        LEFT JOIN shift_groups sg ON b.group_id = sg.id
        WHERE 1=1 ${bindWhere}
        ORDER BY b.duty_time, b.name
      `).bind(...bindArgs).all();

      const bindings = bindingsResult.results || [];

      if (bindings.length > 0) {
        const bindNames = [...new Set(bindings.map(b => b.name))];

        const signinResults = await env.DB.prepare(`
          SELECT sr.name, sr.duty_date, sr.duty_time
          FROM signin_records sr
          WHERE sr.duty_date >= ? AND sr.duty_date <= ?
            AND sr.name IN (${bindNames.map(() => '?').join(',')})
        `).bind(startDate || dateRange[0], endDate || dateRange[dateRange.length - 1], ...bindNames).all();

        const signins = signinResults.results || [];
        const signinSet = new Set(signins.map(s => `${s.name}|${s.duty_date}|${s.duty_time}`));
        const seen = new Set(missed.map(m => `${m.name}|${m.duty_date}|${m.duty_time}`));

        for (const binding of bindings) {
          for (const date of dateRange) {
            const key = `${binding.name}|${date}|${binding.duty_time}`;
            if (!signinSet.has(key) && !seen.has(key)) {
              missed.push({
                duty_date: date,
                duty_time: binding.duty_time,
                name: binding.name,
                group_id: binding.group_id,
                group_name: binding.group_name
              });
              seen.add(key);
            }
          }
        }
      }
    }

    missed.sort((a, b) => {
      if (a.duty_date !== b.duty_date) return b.duty_date.localeCompare(a.duty_date);
      if (a.duty_time !== b.duty_time) return a.duty_time.localeCompare(b.duty_time);
      return a.name.localeCompare(b.name);
    });

    return Response.json({ success: true, data: missed });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
