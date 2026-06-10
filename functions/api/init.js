export async function onRequestGet({ env }) {
  try {
    // 检查表是否已存在
    const checkResult = await env.DB.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='duty_config'
    `).first();
    
    if (checkResult) {
      return Response.json({ 
        success: true, 
        message: '数据库表已存在',
        status: 'exists'
      });
    }
    
    // 创建所有表
    await env.DB.batch([
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS duty_config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          duty_date TEXT NOT NULL,
          duty_time TEXT NOT NULL,
          name TEXT NOT NULL
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS signin_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          duty_date TEXT NOT NULL,
          duty_time TEXT NOT NULL,
          created_at TEXT NOT NULL,
          ip_address TEXT,
          UNIQUE(name, duty_date, duty_time)
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS duty_roster (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          person_name TEXT NOT NULL UNIQUE,
          order_index INTEGER NOT NULL
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS allowed_persons (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)
    ]);
    
    // 插入默认人员名单
    const defaultPersons = [
      '贪狼', '破军', '七杀', '廉贞', 
      '武曲', '文曲', '禄存', '巨门'
    ];
    
    const insertBatch = defaultPersons.map(name => 
      env.DB.prepare(`
        INSERT OR IGNORE INTO allowed_persons (name) VALUES (?)
      `).bind(name)
    );
    
    await env.DB.batch(insertBatch);
    
    return Response.json({ 
      success: true, 
      message: '数据库表创建成功',
      status: 'created',
      tables: ['duty_config', 'signin_records', 'duty_roster', 'allowed_persons']
    });
  } catch (error) {
    console.error('初始化数据库失败:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
