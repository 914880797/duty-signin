// 初始化管理员账号配置
export async function onRequestPost({ request, env }) {
  try {
    const { admins } = await request.json();
    
    if (!admins || !Array.isArray(admins) || admins.length === 0) {
      return Response.json({ error: '缺少管理员配置' }, { status: 400 });
    }
    
    // 创建 admin_users 表（如果不存在）
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    
    // 清空现有管理员账号
    await env.DB.prepare(`DELETE FROM admin_users`).run();
    
    // 哈希函数（SHA-256 + salt）
    async function hashPassword(password, salt) {
      const encoder = new TextEncoder();
      const data = encoder.encode(password + salt);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    const batch = [];
    for (const admin of admins) {
      if (!admin.username || !admin.password) {
        return Response.json({ error: '管理员账号缺少用户名或密码' }, { status: 400 });
      }
      
      const passwordHash = await hashPassword(admin.password, 'monkeycode_salt_2026');
      
      batch.push(
        env.DB.prepare(`
          INSERT INTO admin_users (username, password_hash, is_active)
          VALUES (?, ?, ?)
        `).bind(admin.username, passwordHash, admin.is_active !== false ? 1 : 0)
      );
    }
    
    await env.DB.batch(batch);
    
    return Response.json({
      success: true,
      message: `成功初始化 ${admins.length} 个管理员账号`,
      count: batch.length
    });
  } catch (error) {
    console.error('Init admin config error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
