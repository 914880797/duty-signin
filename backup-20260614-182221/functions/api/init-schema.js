// 创建 duty_bindings 表的迁移脚本
export async function onRequestPost({ env }) {
  try {
    // 检查表是否存在
    const check = await env.DB.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='duty_bindings'
    `).first();
    
    if (!check) {
      // 创建绑定表（人员与时段的永久绑定）
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
      
      // 从现有排班中导入数据（过去 365 天的排班）
      await env.DB.prepare(`
        INSERT OR IGNORE INTO duty_bindings (duty_time, name, group_id)
        SELECT DISTINCT duty_time, name, group_id
        FROM duty_config
        WHERE duty_date >= date('now', '-365 days')
      `).run();
      
      return Response.json({
        success: true,
        message: 'duty_bindings 表已创建并从历史排班导入数据',
        created: true
      });
    }
    
    return Response.json({
      success: true,
      message: 'duty_bindings 表已存在',
      created: false
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
