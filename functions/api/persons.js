// 获取允许人员名单
export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT id, name, is_active, created_at 
      FROM allowed_persons 
      WHERE is_active = 1
      ORDER BY name
    `).all();
    
    return Response.json({
      success: true,
      data: results || []
    });
  } catch (error) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
}

// 添加人员到允许名单
export async function onRequestPost({ request, env }) {
  try {
    const { name } = await request.json();
    
    if (!name || !name.trim()) {
      return Response.json({ error: '姓名不能为空' }, { status: 400 });
    }
    
    const trimmedName = name.trim();
    
    // 添加或激活人员
    await env.DB.prepare(`
      INSERT INTO allowed_persons (name, is_active) 
      VALUES (?, 1)
      ON CONFLICT (name) DO UPDATE SET is_active = 1, updated_at = CURRENT_TIMESTAMP
    `).bind(trimmedName).run();
    
    return Response.json({
      success: true,
      message: '人员已添加到允许名单'
    });
  } catch (error) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
}

// 从允许名单中删除人员
export async function onRequestDelete({ request, env }) {
  try {
    const { name } = await request.json();
    
    if (!name) {
      return Response.json({ error: '缺少姓名参数' }, { status: 400 });
    }
    
    // 软删除：设置为非活跃状态
    await env.DB.prepare(`
      UPDATE allowed_persons 
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE name = ?
    `).bind(name.trim()).run();
    
    return Response.json({
      success: true,
      message: '人员已从允许名单中移除'
    });
  } catch (error) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
}
