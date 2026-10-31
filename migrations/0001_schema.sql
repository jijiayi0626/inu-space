-- INU 星际通行证 · D1 schema
-- 所有时间统一使用 UTC ISO-8601 字符串，展示层再按本地时区格式化。

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  inu_id TEXT NOT NULL UNIQUE,
  orbit_code TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  avatar_text TEXT NOT NULL DEFAULT '逸',
  level INTEGER NOT NULL DEFAULT 1,
  member_tier TEXT NOT NULL DEFAULT 'stardust',
  particles INTEGER NOT NULL DEFAULT 0,
  star_energy_cents INTEGER NOT NULL DEFAULT 0,
  miles INTEGER NOT NULL DEFAULT 0,
  verified INTEGER NOT NULL DEFAULT 0,
  phone TEXT,
  two_fa INTEGER NOT NULL DEFAULT 0,
  guard_geo INTEGER NOT NULL DEFAULT 1,
  guard_device INTEGER NOT NULL DEFAULT 1,
  guard_sensitive INTEGER NOT NULL DEFAULT 0,
  password_changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT,
  last_login_ip TEXT,
  last_login_device TEXT,
  last_login_location TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip TEXT,
  location TEXT,
  user_agent TEXT,
  device_id INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'laptop',
  os TEXT NOT NULL,
  ip TEXT NOT NULL,
  location TEXT NOT NULL,
  method TEXT NOT NULL,
  last_active_at TEXT NOT NULL,
  trusted INTEGER NOT NULL DEFAULT 1,
  is_current INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);

CREATE TABLE IF NOT EXISTS security_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  event TEXT NOT NULL,
  detail TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'green',
  icon TEXT NOT NULL DEFAULT 'i-check',
  occurred_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_security_logs_user ON security_logs(user_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'green',
  icon TEXT NOT NULL DEFAULT 'i-check',
  occurred_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS particle_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  delta INTEGER NOT NULL,
  balance INTEGER NOT NULL,
  occurred_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_particle_logs_user ON particle_logs(user_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS agreements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  signed_at TEXT,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_agreements_user ON agreements(user_id, sort);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  code TEXT NOT NULL UNIQUE,
  product_id TEXT NOT NULL,
  item TEXT NOT NULL,
  energy_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS addresses (
  user_id INTEGER PRIMARY KEY,
  receiver TEXT NOT NULL,
  phone TEXT NOT NULL,
  region TEXT NOT NULL,
  detail TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS notification_settings (
  user_id INTEGER PRIMARY KEY,
  dnd_enabled INTEGER NOT NULL DEFAULT 0,
  dnd_start TEXT NOT NULL DEFAULT '22:00',
  dnd_end TEXT NOT NULL DEFAULT '08:00',
  digest_enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS login_guards (
  email TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  first_failure_at TEXT,
  locked_until TEXT
);
