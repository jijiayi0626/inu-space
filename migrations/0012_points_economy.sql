-- 积分经济平衡：每日签到、新人奖励、会员卡改为积分购买并按天计算有效期。

ALTER TABLE products ADD COLUMN grant_days INTEGER NOT NULL DEFAULT 30;
UPDATE products SET grant_days = grant_months * 30 WHERE kind = 'membership';

-- 余额购买暂时关闭，会员卡统一改为积分兑换。
-- 下架旧的余额会员商品，保留历史订单引用
UPDATE products SET active = 0 WHERE kind = 'membership';

INSERT OR IGNORE INTO products
  (id, name, desc, price_cents, points_price, payment_mode, kind, grant_tier, grant_months, grant_days, app_key,
   icon, tag, tone, stock, active, sort, updated_at)
VALUES
  ('silver-week', '白银会员 · 7 天',
   '7 天白银会员：商城 98 折、余额兑换积分 +2%，到期自动回落到成长等级。',
   0, 400, 'points', 'membership', 'silver', 0, 7, '',
   'i-star', '7 天', 'cyan', -1, 1, 9, datetime('now')),
  ('silver-month', '白银会员 · 30 天',
   '30 天白银会员：商城 98 折、余额兑换积分 +2%，到期自动回落到成长等级。',
   0, 1200, 'points', 'membership', 'silver', 1, 30, '',
   'i-star', '30 天', 'blue', -1, 1, 10, datetime('now')),
  ('gold-month', '黄金会员 · 30 天',
   '30 天黄金会员：商城 95 折、余额兑换积分 +5%，到期自动回落到成长等级。',
   0, 3000, 'points', 'membership', 'gold', 1, 30, '',
   'i-star', '30 天', 'orange', -1, 1, 11, datetime('now')),
  ('platinum-month', '铂金会员 · 30 天',
   '30 天铂金会员：商城 92 折、余额兑换积分 +8%、专属客服，到期自动回落到成长等级。',
   0, 8000, 'points', 'membership', 'platinum', 1, 30, '',
   'i-grid', '30 天', 'purple', -1, 1, 12, datetime('now'));

CREATE TABLE IF NOT EXISTS checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  checkin_date TEXT NOT NULL,
  points INTEGER NOT NULL,
  streak INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS idx_checkins_user ON checkins(user_id, checkin_date DESC);

-- 钱相关接口保持关闭：在线支付、充值、提现全部停用
UPDATE app_settings SET value = 'off' WHERE key = 'site.payment_mode';
UPDATE app_settings SET value = '0' WHERE key = 'site.feature_recharge';
UPDATE app_settings SET value = '0' WHERE key = 'site.feature_withdraw';
