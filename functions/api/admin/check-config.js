import { jsonSuccess, jsonError, verifyAdmin } from '../_shared.js';

export async function onRequestGet({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
  try {
    const tableCheck = await env.DB.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='admin_users'
    `).first();
    
    if (!tableCheck) {
      return jsonSuccess({
        tableExists: false,
        message: 'admin_users 表不存在，请先调用 /api/admin/init-config 初始化'
      });
    }
    
    const { results } = await env.DB.prepare(`
      SELECT id, username, is_active, created_at FROM admin_users
      ORDER BY id ASC
    `).all();
    
    return jsonSuccess({
      tableExists: true,
      admins: results || [],
      count: results ? results.length : 0
    });
  } catch (error) {
    console.error('Check admin config error:', error);
    return jsonError(error.message);
  }
}
