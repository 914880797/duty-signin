export async function onRequestPost({ request, env }) {
  try {
    const ip = 'makeup';
    const json = await request.json();
    const { name, duty_date, duty_time, group_id } = json;

    if (!name || !name.trim()) {
      return Response.json({ error: '姓名不能为空' }, { status: 400 });
    }
    if (!duty_date) {
      return Response.json({ error: '日期不能为空' }, { status: 400 });
    }
    if (!duty_time) {
      return Response.json({ error: '时段不能为空' }, { status: 400 });
    }

    const trimmedName = name.trim();

    const existing = await env.DB.prepare(`
      SELECT id FROM signin_records
      WHERE name = ? AND duty_date = ? AND duty_time = ?
    `).bind(trimmedName, duty_date, duty_time).first();

    if (existing) {
      return Response.json({ error: '该时段已打卡，无需重复补卡' }, { status: 400 });
    }

    const now = new Date();
    const bjTimestamp = now.getTime() + 8 * 60 * 60 * 1000;
    const bj = new Date(bjTimestamp);
    const pad = (n) => String(n).padStart(2, '0');
    const created_at = `${bj.getUTCFullYear()}-${pad(bj.getUTCMonth() + 1)}-${pad(bj.getUTCDate())} ${pad(bj.getUTCHours())}:${pad(bj.getUTCMinutes())}:${pad(bj.getUTCSeconds())}`;

    await env.DB.prepare(`
      INSERT INTO signin_records (name, duty_date, duty_time, group_id, created_at, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(trimmedName, duty_date, duty_time, group_id || null, created_at, ip).run();

    return Response.json({
      success: true,
      name: trimmedName,
      duty_date,
      duty_time,
      created_at
    });
  } catch (e) {
    console.error('Makeup signin error:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
