import { formatBeijingNow, jsonSuccess, jsonError } from './_shared.js';

export async function onRequestPost({ request, env }) {
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

    await env.DB.prepare(
      `INSERT INTO signin_records (name, duty_date, duty_time, group_id, created_at, record_type) VALUES (?, ?, ?, ?, ?, 'makeup')`
    ).bind(trimmedName, duty_date, duty_time, group_id || null, created_at).run();

    return jsonSuccess({ name: trimmedName, duty_date, duty_time, created_at });
  } catch (e) {
    console.error('Makeup signin error:', e);
    return jsonError(e.message);
  }
}
