import { jsonSuccess, jsonError, verifyAdmin } from './_shared.js';

// 获取所有分组
export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT id, name, order_index FROM shift_groups
      ORDER BY order_index ASC, id ASC
    `).all();
    
    return jsonSuccess({
      data: results || [],
      count: results ? results.length : 0
    });
  } catch (error) {
    return jsonError(error.message);
  }
}

// 创建新分组
export async function onRequestPost({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
  try {
    const { name, order_index = 0 } = await request.json();
    
    if (!name || !name.trim()) {
      return jsonError('分组名称不能为空', 400);
    }
    
    const trimmedName = name.trim();
    
    const exists = await env.DB.prepare(`
      SELECT id FROM shift_groups WHERE name = ?
    `).bind(trimmedName).first();
    
    if (exists) {
      return jsonError('分组名称已存在', 400);
    }
    
    await env.DB.prepare(`
      INSERT INTO shift_groups (name, order_index) VALUES (?, ?)
    `).bind(trimmedName, order_index).run();
    
    return jsonSuccess({ message: '分组创建成功' });
  } catch (error) {
    return jsonError(error.message);
  }
}

// 更新分组（重命名或调整顺序）
export async function onRequestPut({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
  try {
    const { id, name, order_index } = await request.json();
    
    if (!id) {
      return jsonError('缺少分组 ID', 400);
    }
    
    if (name && name.trim()) {
      const trimmedName = name.trim();
      
      const exists = await env.DB.prepare(`
        SELECT id FROM shift_groups WHERE name = ? AND id != ?
      `).bind(trimmedName, id).first();
      
      if (exists) {
        return jsonError('分组名称已存在', 400);
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
    
    return jsonSuccess({ message: '分组更新成功' });
  } catch (error) {
    return jsonError(error.message);
  }
}

// 删除分组
export async function onRequestDelete({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
  try {
    const { id } = await request.json();
    
    if (!id) {
      return jsonError('缺少分组 ID', 400);
    }
    
    const inUse = await env.DB.prepare(`
      SELECT id FROM duty_config WHERE group_id = ? LIMIT 1
    `).bind(id).first();
    
    if (inUse) {
      return jsonError('该分组下已有排班，无法删除', 400);
    }
    
    await env.DB.prepare(`
      DELETE FROM shift_groups WHERE id = ?
    `).bind(id).run();
    
    return jsonSuccess({ message: '分组删除成功' });
  } catch (error) {
    return jsonError(error.message);
  }
}
