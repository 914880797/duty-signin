// 验证管理员配置
export async function onRequestGet({ env }) {
  try {
    // 检查表是否存在
    const tableCheck = await env.DB.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='admin_users'
    `).first();
    
    if (!tableCheck) {
      return Response.json({
        success: true,
        tableExists: false,
        message: 'admin_users 表不存在，请先调用 /api/admin/init-config 初始化'
      });
    }
    
    // 查询所有管理员账号（不显示密码）
    const { results } = await env.DB.prepare(`
      SELECT id, username, is_active, created_at FROM admin_users
      ORDER BY id ASC
    `).all();
    
    return Response.json({
      success: true,
      tableExists: true,
      admins: results || [],
      count: results ? results.length : 0
    });
  } catch (error) {
    console.error('Check admin config error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
