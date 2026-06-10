export async function onRequestGet({ env }) {
  try {
    // 删除旧表（如果存在）然后重建
    await env.DB.batch([
      // 删除旧表
      env.DB.prepare(`DROP TABLE IF EXISTS duty_config`),
      env.DB.prepare(`DROP TABLE IF EXISTS signin_records`),
      env.DB.prepare(`DROP TABLE IF EXISTS duty_roster`),
      env.DB.prepare(`DROP TABLE IF EXISTS allowed_persons`),
      
      // 创建新表
      env.DB.prepare(`
        CREATE TABLE duty_config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          duty_date TEXT NOT NULL,
          duty_time TEXT NOT NULL,
          name TEXT NOT NULL
        )
      `),
      env.DB.prepare(`
        CREATE TABLE signin_records (
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
        CREATE TABLE duty_roster (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          person_name TEXT NOT NULL UNIQUE,
          order_index INTEGER NOT NULL
        )
      `),
      env.DB.prepare(`
        CREATE TABLE allowed_persons (
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
        INSERT INTO allowed_persons (name) VALUES (?)
      `).bind(name)
    );
    
    await env.DB.batch(insertBatch);
    
    return Response.json({ 
      success: true, 
      message: '数据库表重建成功',
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
