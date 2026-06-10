// 获取所有分组
export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT id, name, order_index FROM shift_groups
      ORDER BY order_index ASC, id ASC
    `).all();
    
    return Response.json({
      success: true,
      data: results || [],
      count: results ? results.length : 0
    });
  } catch (error) {
    console.error('获取分组失败:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// 创建新分组
export async function onRequestPost({ request, env }) {
  try {
    const { name, order_index = 0 } = await request.json();
    
    if (!name || !name.trim()) {
      return Response.json({ error: '分组名称不能为空' }, { status: 400 });
    }
    
    const trimmedName = name.trim();
    
    // 检查是否已存在
    const exists = await env.DB.prepare(`
      SELECT id FROM shift_groups WHERE name = ?
    `).bind(trimmedName).first();
    
    if (exists) {
      return Response.json({ error: '分组名称已存在' }, { status: 400 });
    }
    
    await env.DB.prepare(`
      INSERT INTO shift_groups (name, order_index) VALUES (?, ?)
    `).bind(trimmedName, order_index).run();
    
    return Response.json({
      success: true,
      message: '分组创建成功'
    });
  } catch (error) {
    console.error('创建分组失败:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// 更新分组（重命名或调整顺序）
export async function onRequestPut({ request, env }) {
  try {
    const { id, name, order_index } = await request.json();
    
    if (!id) {
      return Response.json({ error: '缺少分组 ID' }, { status: 400 });
    }
    
    if (name && name.trim()) {
      const trimmedName = name.trim();
      
      // 检查新名称是否已被其他分组使用
      const exists = await env.DB.prepare(`
        SELECT id FROM shift_groups WHERE name = ? AND id != ?
      `).bind(trimmedName, id).first();
      
      if (exists) {
        return Response.json({ error: '分组名称已存在' }, { status: 400 });
      }
      
      await env.DB.prepare(`
        UPDATE shift_groups SET name = ? WHERE id = ?
      `).bind(trimmedName, id).run();
    }
    
    if (order_index !== undefined) {
      await env.DB.prepare(`
        UPDATE shift_groups SET order_index = ? WHERE id = ?
      `).bind(order_index, id).run();
    }
    
    return Response.json({
      success: true,
      message: '分组更新成功'
    });
  } catch (error) {
    console.error('更新分组失败:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// 删除分组
export async function onRequestDelete({ request, env }) {
  try {
    const { id } = await request.json();
    
    if (!id) {
      return Response.json({ error: '缺少分组 ID' }, { status: 400 });
    }
    
    // 检查是否有排班使用该分组
    const inUse = await env.DB.prepare(`
      SELECT id FROM duty_config WHERE group_id = ? LIMIT 1
    `).bind(id).first();
    
    if (inUse) {
      return Response.json({ 
        error: '该分组下已有排班，无法删除' 
      }, { status: 400 });
    }
    
    await env.DB.prepare(`
      DELETE FROM shift_groups WHERE id = ?
    `).bind(id).run();
    
    return Response.json({
      success: true,
      message: '分组删除成功'
    });
  } catch (error) {
    console.error('删除分组失败:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
