import { jsonSuccess, jsonError } from './_shared.js';

export async function onRequestDelete({ request, env }) {
  try {
    const { duty_time } = await request.json();

    if (!duty_time) {
      return jsonError('duty_time is required', 400);
    }

    const results = await env.DB.batch([
      env.DB.prepare(`DELETE FROM duty_config WHERE duty_time = ?`).bind(duty_time),
      env.DB.prepare(`DELETE FROM duty_bindings WHERE duty_time = ?`).bind(duty_time)
    ]);

    const dcDeleted = results[0]?.meta?.changes || 0;
    const dbDeleted = results[1]?.meta?.changes || 0;

    return jsonSuccess({
      deleted_duty_config: dcDeleted,
      deleted_duty_bindings: dbDeleted
    });
  } catch (error) {
    return jsonError(error.message);
  }
}
