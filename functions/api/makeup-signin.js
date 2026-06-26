import { formatBeijingNow, jsonSuccess, jsonError, verifyAdmin } from './_shared.js';

export async function onRequestPost({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
  try {
    const json = await request.json();
    const { name, duty_date, duty_time, group_id } = json;

    if (!name || !name.trim()) return jsonError('姓名不能为空', 400);
    if (!duty_date) return jsonError('日期不能为空', 400);
    if (!duty_time) return jsonError('时段不能为空', 400);

    const trimmedName = name.trim();

    const existing = await env.DB.prepare(
      `SELECT id FROM signin_records WHERE name = ? AND duty_date = ? AND duty_time = ?`
    ).bind(trimmedName, duty_date, duty_time).first();

    if (existing) {
      return jsonError('该时段已打卡，无需重复补卡', 400);
    }

    const created_at = formatBeijingNow();

    let inserted = false;
    try {
      await env.DB.prepare(
        `INSERT INTO signin_records (name, duty_date, duty_time, group_id, created_at, record_type) VALUES (?, ?, ?, ?, ?, 'makeup')`
      ).bind(trimmedName, duty_date, duty_time, group_id || null, created_at).run();
      inserted = true;
    } catch (e) {
      if (e.message.includes('no column named record_type') || e.message.includes('no column: record_type')) {
        await env.DB.prepare(
          `INSERT INTO signin_records (name, duty_date, duty_time, group_id, created_at, ip_address) VALUES (?, ?, ?, ?, ?, 'makeup')`
        ).bind(trimmedName, duty_date, duty_time, group_id || null, created_at).run();
        inserted = true;
      } else {
        throw e;
      }
    }

    if (!inserted) return jsonError('服务器错误');

    return jsonSuccess({ name: trimmedName, duty_date, duty_time, created_at });
  } catch (e) {
    console.error('Makeup signin error:', e);
    return jsonError(e.message);
  }
}
