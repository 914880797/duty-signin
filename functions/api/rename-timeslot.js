export async function onRequestPost({ request, env }) {
  try {
    const { old_name, new_name } = await request.json();

    if (!old_name || !new_name || old_name === new_name) {
      return Response.json({ success: false, error: 'old_name and new_name are required and must differ' }, { status: 400 });
    }

    const results = await env.DB.batch([
      env.DB.prepare(`UPDATE duty_config SET duty_time = ? WHERE duty_time = ?`).bind(new_name, old_name),
      env.DB.prepare(`UPDATE duty_bindings SET duty_time = ? WHERE duty_time = ?`).bind(new_name, old_name)
    ]);

    const dcUpdated = results[0]?.meta?.changes || 0;
    const dbUpdated = results[1]?.meta?.changes || 0;

    return Response.json({
      success: true,
      updated_duty_config: dcUpdated,
      updated_duty_bindings: dbUpdated
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
