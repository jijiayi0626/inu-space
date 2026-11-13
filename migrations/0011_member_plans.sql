-- 会员体系扩展：成长等级 + 付费会员卡（按有效期生效）。
-- 付费会员到期后自动回落到成长等级，成长等级只升不降。

ALTER TABLE users ADD COLUMN member_paid_tier TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN member_paid_until TEXT;
ALTER TABLE products ADD COLUMN grant_months INTEGER NOT NULL DEFAULT 12;

-- 示例会员商品：余额购买，12 个月有效，未实名认证也可购买。
INSERT OR IGNORE INTO products
  (id, name, desc, price_cents, points_price, payment_mode, kind, grant_tier, grant_months, app_key,
   icon, tag, tone, stock, active, sort, updated_at)
VALUES
  ('gold-year', '黄金会员 · 12 个月',
   '立即解锁黄金会员：商城 95 折、余额兑换积分 +5%，到期后回落到成长等级。',
   9900, 0, 'balance', 'membership', 'gold', 12, '',
   'i-star', '年卡', 'orange', -1, 1, 9, datetime('now')),
  ('platinum-year', '铂金会员 · 12 个月',
   '立即解锁铂金会员：商城 92 折、余额兑换积分 +8%、专属客服，到期后回落到成长等级。',
   29900, 0, 'balance', 'membership', 'platinum', 12, '',
   'i-grid', '年卡', 'purple', -1, 1, 10, datetime('now'));
