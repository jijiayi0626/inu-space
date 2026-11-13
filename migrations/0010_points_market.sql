-- 积分商城拆分：商品支持积分价 / 余额价、实物 / 会员 / 应用权益。
-- 会员等级同步修复：等级按历史最高积分计算，写入 member_tier。

CREATE TABLE IF NOT EXISTS products_v2 (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  desc TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL DEFAULT 0,
  points_price INTEGER NOT NULL DEFAULT 0,
  payment_mode TEXT NOT NULL DEFAULT 'points',
  kind TEXT NOT NULL DEFAULT 'goods',
  grant_tier TEXT NOT NULL DEFAULT '',
  app_key TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'i-box',
  tag TEXT NOT NULL DEFAULT '',
  tone TEXT NOT NULL DEFAULT 'blue',
  stock INTEGER NOT NULL DEFAULT -1,
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO products_v2
  (id, name, desc, price_cents, points_price, payment_mode, kind, grant_tier, app_key,
   icon, tag, tone, stock, active, sort, updated_at)
SELECT id, name, desc, price_cents, price_cents, 'balance', 'goods', '', '',
       icon, tag, tone, stock, active, sort, updated_at
FROM products;

DROP TABLE products;
ALTER TABLE products_v2 RENAME TO products;

-- 按需求先清空商城：商品由管理后台重新上架。
DELETE FROM products;

CREATE TABLE IF NOT EXISTS orders_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  code TEXT NOT NULL UNIQUE,
  product_id TEXT NOT NULL,
  item TEXT NOT NULL,
  energy_cents INTEGER NOT NULL DEFAULT 0,
  points_spent INTEGER NOT NULL DEFAULT 0,
  payment_mode TEXT NOT NULL DEFAULT 'balance',
  kind TEXT NOT NULL DEFAULT 'goods',
  status TEXT NOT NULL DEFAULT 'paid',
  created_at TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  tracking_no TEXT,
  carrier TEXT,
  updated_at TEXT,
  paid_at TEXT,
  delivered_at TEXT,
  cancelled_at TEXT
);

INSERT OR IGNORE INTO orders_v2
  (id, user_id, code, product_id, item, energy_cents, points_spent, payment_mode, kind,
   status, created_at, address, tracking_no, carrier, updated_at, paid_at, delivered_at, cancelled_at)
SELECT id, user_id, code, product_id, item, energy_cents, 0, 'balance', 'goods',
       status, created_at, address, tracking_no, carrier, updated_at, paid_at, delivered_at, cancelled_at
FROM orders;

DROP TABLE orders;
ALTER TABLE orders_v2 RENAME TO orders;
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_entitlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  app_key TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT '',
  order_id INTEGER,
  granted_at TEXT NOT NULL,
  UNIQUE (user_id, app_key)
);
CREATE INDEX IF NOT EXISTS idx_entitlements_user ON user_entitlements(user_id);

-- 已有用户按当前积分补齐一次等级，避免历史数据停在普通等级。
UPDATE users
SET member_tier = CASE
  WHEN particles >= 200000 THEN 'platinum'
  WHEN particles >= 50000 THEN 'gold'
  WHEN particles >= 10000 THEN 'silver'
  WHEN member_tier IN ('silver', 'gold', 'platinum') THEN member_tier
  ELSE 'basic'
END;
