export async function onRequestPost({ request, env }) {
  try {
    const { valid_duty_times } = await request.json();

    if (!Array.isArray(valid_duty_times) || valid_duty_times.length === 0) {
      return Response.json({ success: false, error: 'valid_duty_times array is required' }, { status: 400 });
    }

    const placeholders = valid_duty_times.map(() => '?').join(',');

    const dcResult = await env.DB.prepare(`
      DELETE FROM duty_config WHERE duty_time NOT IN (${placeholders})
        AND duty_time IS NOT NULL AND duty_time != '' AND duty_time != '未安排'
    `).bind(...valid_duty_times).run();

    const dbResult = await env.DB.prepare(`
      DELETE FROM duty_bindings WHERE duty_time NOT IN (${placeholders})
    `).bind(...valid_duty_times).run();

    return Response.json({
      success: true,
      deleted_duty_config: dcResult.meta?.changes || 0,
      deleted_duty_bindings: dbResult.meta?.changes || 0
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
