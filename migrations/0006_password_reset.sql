-- 0006_password_reset.sql
-- 忘记密码找回申请：仅记录申请并通知管理员，密码由管理员在控制台重置。

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  handled_at TEXT,
  handled_by INTEGER
);

CREATE INDEX IF NOT EXISTS idx_password_reset_status
  ON password_reset_requests (status, created_at DESC);
