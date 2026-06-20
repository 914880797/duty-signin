-- 值班分组表
CREATE TABLE IF NOT EXISTS shift_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  order_index INTEGER NOT NULL DEFAULT 0
);

-- 插入默认分组
INSERT OR IGNORE INTO shift_groups (name, order_index) VALUES 
  ('会议室', 1),
  ('电报', 2),
  ('其他', 3);

CREATE TABLE IF NOT EXISTS duty_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  duty_date TEXT NOT NULL,
  duty_time TEXT NOT NULL,
  name TEXT NOT NULL,
  group_id INTEGER,
  FOREIGN KEY (group_id) REFERENCES shift_groups(id)
);

CREATE TABLE IF NOT EXISTS signin_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  duty_date TEXT NOT NULL,
  duty_time TEXT NOT NULL,
  group_id INTEGER,
  created_at TEXT NOT NULL,
  ip_address TEXT,
  record_type TEXT DEFAULT 'signin',
  FOREIGN KEY (group_id) REFERENCES shift_groups(id),
  UNIQUE(name, duty_date, duty_time)
);

CREATE TABLE IF NOT EXISTS duty_roster (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_name TEXT NOT NULL UNIQUE,
  order_index INTEGER NOT NULL
);

-- 值班人员白名单表
CREATE TABLE IF NOT EXISTS allowed_persons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 系统设置表
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 公告表
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认允许人员名单（请根据实际情况修改）
INSERT OR IGNORE INTO allowed_persons (name) VALUES 
  ('贪狼'),
  ('破军'),
  ('七杀'),
  ('廉贞'),
  ('武曲'),
  ('文曲'),
  ('禄存'),
  ('巨门');