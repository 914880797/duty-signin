import { jsonSuccess, jsonError, verifyAdmin } from './_shared.js';

export async function onRequestPost({ request, env }) {
  const isAdmin = await verifyAdmin(request, env);
  if (!isAdmin) return jsonError('未授权访问', 401);
  try {
    const check = await env.DB.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='duty_bindings'
    `).first();
    
    if (!check) {
      await env.DB.prepare(`
        CREATE TABLE duty_bindings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          duty_time TEXT NOT NULL,
          name TEXT NOT NULL,
          group_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(duty_time, name)
        )
      `).run();
      
      await env.DB.prepare(`
        INSERT OR IGNORE INTO duty_bindings (duty_time, name, group_id)
        SELECT DISTINCT duty_time, name, group_id
        FROM duty_config
        WHERE duty_date >= date('now', '-365 days')
      `).run();
      
      return jsonSuccess({
        message: 'duty_bindings 表已创建并从历史排班导入数据',
        created: true
      });
    }
    
    return jsonSuccess({
      message: 'duty_bindings 表已存在',
      created: false
    });
  } catch (error) {
    return jsonError(error.message);
  }
}
