import { jsonSuccess, jsonError, verifyAdmin } from './_shared.js';

export async function onRequestPost({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
  try {
    const body = await request.json();
    const names = body.names;
    const duty_time = body.duty_time;
    const group_id = body.group_id || null;
    const startDate = body.start_date || body.duty_date;
    const endDate = body.end_date || body.start_date || body.duty_date;

    if (!names || !Array.isArray(names) || names.length === 0) {
      return jsonError('人员名单不能为空', 400);
    }
    if (!startDate) {
      return jsonError('日期不能为空', 400);
    }
    if (!duty_time) {
      return jsonError('时段不能为空', 400);
    }

    // Build date range
    const dates = [];
    const s = new Date(startDate + 'T00:00:00Z');
    const e = new Date(endDate + 'T00:00:00Z');
    for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }

    let inserted = 0;
    let skipped = 0;
    const stmt = env.DB.prepare(`
      INSERT OR IGNORE INTO duty_config (duty_date, duty_time, name, group_id)
      VALUES (?, ?, ?, ?)
    `);

    const batch = [];
    for (const name of names) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      for (const date of dates) {
        batch.push(stmt.bind(date, duty_time, trimmed, group_id));
      }
    }

    const results = await env.DB.batch(batch);
    for (const r of results) {
      if (r.success) inserted++;
      else skipped++;
    }

    return jsonSuccess({
      inserted,
      skipped,
      total: names.length * dates.length
    });
  } catch (error) {
    return jsonError(error.message);
  }
}
