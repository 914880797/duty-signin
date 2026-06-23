import { hashPassword, jsonError, jsonSuccess } from '../_shared.js';

export async function onRequestPost({ request, env }) {
  try {
    const { admins } = await request.json();

    if (!admins || !Array.isArray(admins) || admins.length === 0) {
      return jsonError('缺少管理员配置', 400);
    }

    let existingCount = 0;
    try {
      const result = await env.DB.prepare(`SELECT COUNT(*) as cnt FROM admin_users`).first();
      existingCount = result ? result.cnt : 0;
    } catch (e) {
      // 表不存在，允许引导
    }

    if (existingCount > 0) {
      const { verifyAdmin } = await import('../_shared.js');
      const isAdmin = await verifyAdmin(request, env);
      if (!isAdmin) return jsonError('未授权访问', 401);
    }

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

    await env.DB.prepare(`DELETE FROM admin_users`).run();

    const batch = [];
    for (const admin of admins) {
      if (!admin.username || !admin.password) {
        return jsonError('管理员账号缺少用户名或密码', 400);
      }
      const passwordHash = await hashPassword(admin.password);
      batch.push(
        env.DB.prepare(
          `INSERT INTO admin_users (username, password_hash, is_active) VALUES (?, ?, ?)`
        ).bind(admin.username, passwordHash, admin.is_active !== false ? 1 : 0)
      );
    }

    await env.DB.batch(batch);
    return jsonSuccess({ message: `成功初始化 ${admins.length} 个管理员账号`, count: batch.length });
  } catch (error) {
    console.error('Init admin config error:', error);
    return jsonError(error.message);
  }
}
