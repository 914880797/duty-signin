export async function onRequestPost({ env }) {
  try {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO duty_bindings (duty_time, name, group_id)
      SELECT DISTINCT duty_time, name, group_id
      FROM duty_config
      WHERE duty_time IS NOT NULL
        AND duty_time != ''
        AND duty_time != '未安排'
    `).run();

    return Response.json({ success: true, message: 'duty_bindings 已从 duty_config 同步' });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
