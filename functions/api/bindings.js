// 获取人员时段绑定列表
export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT b.id, b.duty_time, b.name, b.group_id, sg.name as group_name
      FROM duty_bindings b
      LEFT JOIN shift_groups sg ON b.group_id = sg.id
      ORDER BY b.duty_time, b.name
    `).all();
    
    return Response.json({
      success: true,
      data: results || []
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// 添加绑定
export async function onRequestPost({ request, env }) {
  try {
    const { duty_time, name, group_id } = await request.json();
    
    await env.DB.prepare(`
      INSERT OR IGNORE INTO duty_bindings (duty_time, name, group_id)
      VALUES (?, ?, ?)
    `).bind(duty_time, name, group_id || null).run();
    
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// 删除绑定
export async function onRequestDelete({ request, env }) {
  try {
    const { duty_time, name } = await request.json();
    
    await env.DB.prepare(`
      DELETE FROM duty_bindings WHERE duty_time = ? AND name = ?
    `).bind(duty_time, name).run();
    
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
