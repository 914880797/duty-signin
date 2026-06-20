import { jsonSuccess, jsonError } from './_shared.js';

export async function onRequestGet({ env }) {
  try {
    const validTimesSetting = await env.DB.prepare(
      `SELECT value FROM settings WHERE key = 'valid_duty_times'`
    ).first();
    const validDutyTimes = validTimesSetting?.value ? JSON.parse(validTimesSetting.value) : [];

    if (validDutyTimes.length > 0) {
      const results = validDutyTimes.map(t => ({ time_slot: t }));
      return jsonSuccess({ data: results });
    }

    // Fallback: 从 duty_config 获取去重时段
    const { results } = await env.DB.prepare(
      `SELECT DISTINCT duty_time as time_slot FROM duty_config ORDER BY duty_time ASC`
    ).all();

    return jsonSuccess({ data: results || [] });
  } catch (error) {
    return jsonError(error.message);
  }
}
