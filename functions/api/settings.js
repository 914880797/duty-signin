import { jsonSuccess, jsonError } from './_shared.js';

export async function onRequestGet({ env }) {
  try {
    const config = await env.DB.prepare(
      `SELECT value FROM settings WHERE key = 'cycle_start_date'`
    ).first();
    const validTimes = await env.DB.prepare(
      `SELECT value FROM settings WHERE key = 'valid_duty_times'`
    ).first();
    const count = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM signin_records`
    ).first();

    return jsonSuccess({
      cycleStartDate: config?.value || null,
      validDutyTimes: validTimes?.value ? JSON.parse(validTimes.value) : null,
      totalRecords: count?.total || 0
    });
  } catch (error) {
    console.error('Get settings error:', error);
    return jsonError(error.message);
  }
}

export async function onRequestPut({ request, env }) {
  try {
    const data = await request.json();
    const { cycleStartDate, valid_duty_times } = data;

    if (cycleStartDate) {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('cycle_start_date', ?, CURRENT_TIMESTAMP)`
      ).bind(cycleStartDate).run();
    }
    if (valid_duty_times && Array.isArray(valid_duty_times)) {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('valid_duty_times', ?, CURRENT_TIMESTAMP)`
      ).bind(JSON.stringify(valid_duty_times)).run();
    }

    return jsonSuccess();
  } catch (error) {
    console.error('Put settings error:', error);
    return jsonError(error.message);
  }
}
