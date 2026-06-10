CREATE TABLE IF NOT EXISTS duty_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  duty_date TEXT NOT NULL,
  duty_time TEXT NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS signin_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  duty_date TEXT NOT NULL,
  duty_time TEXT NOT NULL,
  created_at TEXT NOT NULL,
  ip_address TEXT,
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