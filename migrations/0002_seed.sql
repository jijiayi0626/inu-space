-- INU 账号中心 · 演示种子数据
-- 演示账号：xiaoyiyi@inu.space / inu2026

INSERT OR REPLACE INTO users (
  id, email, password_hash, display_name, inu_id, orbit_code, region, bio, avatar_text,
  level, member_tier, particles, star_energy_cents, miles, verified, phone,
  two_fa, guard_geo, guard_device, guard_sensitive, password_changed_at, created_at,
  last_login_at, last_login_ip, last_login_device, last_login_location
) VALUES (
  1, 'xiaoyiyi@inu.space',
  'pbkdf2$12000$6ef1f7de26d37c4b149037520bea51aa$be55d5dd5718c0635d883f4352c5c45eda1033a95d41ea65ba6e12c80119ec3f',
  '小逸逸', 'INU·88210·0721', 'INU-88210-0721', '上海 · 中国',
  '把日常过得简单一点，记录每一次小小的进步。', '逸',
  7, 'basic', 8642, 128640, 12480, 0, NULL,
  0, 1, 1, 0, '2026-08-02T10:00:00', '2025-10-10T09:10:00',
  '2026-10-31T09:12:00', '116.24.88.31', 'MacBook Pro 14', '上海 · 中国'
);

DELETE FROM sessions WHERE user_id = 1;
DELETE FROM devices WHERE user_id = 1;
DELETE FROM security_logs WHERE user_id = 1;
DELETE FROM activities WHERE user_id = 1;
DELETE FROM particle_logs WHERE user_id = 1;
DELETE FROM login_guards WHERE email = 'xiaoyiyi@inu.space';
DELETE FROM agreements WHERE user_id = 1;
DELETE FROM orders WHERE user_id = 1;
DELETE FROM addresses WHERE user_id = 1;
DELETE FROM notification_prefs WHERE user_id = 1;
DELETE FROM notification_settings WHERE user_id = 1;

INSERT INTO devices (user_id, name, kind, os, ip, location, method, last_active_at, trusted, is_current) VALUES
  (1, 'MacBook Pro 14', 'laptop', 'macOS 15.1', '116.24.88.31', '上海 · 中国', '密码 + 短信验证', '2026-10-31T09:12:00', 1, 1),
  (1, 'iPhone 15 Pro', 'phone', 'iOS 18.1', '112.17.23.66', '杭州 · 中国', '扫码确认', '2026-10-30T22:41:00', 1, 0),
  (1, 'iPad Air', 'tablet', 'iPadOS 18', '223.104.5.18', '北京 · 中国', '密码登录', '2026-10-01T15:20:00', 1, 0);

INSERT INTO security_logs (user_id, event, detail, tone, icon, occurred_at) VALUES
  (1, '登录成功', 'MacBook Pro 14 · 上海', 'green', 'i-check', '2026-10-31T09:12:00'),
  (1, '新设备登录验证', 'iPhone 15 Pro · 杭州', 'blue', 'i-device', '2026-10-30T22:41:00'),
  (1, '密码修改被拒绝', '非本人操作 · 已拦截', 'orange', 'i-lock', '2026-10-27T03:18:00'),
  (1, '异常登录尝试', 'IP 203.0.113.8 · 已拦截', 'purple', 'i-shield', '2026-10-24T18:06:00');

INSERT INTO activities (user_id, title, detail, tone, icon, occurred_at) VALUES
  (1, '登录成功', 'MacBook Pro 14 · 上海', 'green', 'i-shield', '2026-10-31T09:12:00'),
  (1, '余额充值到账', '+200.00 余额 · 支付', 'blue', 'i-wallet', '2026-10-30T21:04:00'),
  (1, '签署《服务协议》', '协议版本 v2.4', 'purple', 'i-file', '2026-10-29T12:10:00'),
  (1, '新设备登录验证', 'iPhone 15 Pro · 杭州', 'orange', 'i-device', '2026-10-28T09:30:00');

INSERT INTO particle_logs (user_id, label, delta, balance, occurred_at) VALUES
  (1, '每日签到', 20, 8642, '2026-10-31T09:20:00'),
  (1, '积分商城消费', -120, 8622, '2026-10-30T21:04:00'),
  (1, '签署《服务协议》', 50, 8742, '2026-10-29T12:10:00'),
  (1, '新设备登录验证', 30, 8692, '2026-10-28T09:30:00'),
  (1, '连续签到奖励', 15, 8662, '2026-10-27T18:00:00');

INSERT INTO agreements (user_id, title, version, status, signed_at, sort) VALUES
  (1, '服务协议', 'v2.4', 'signed', '2026-10-29T12:10:00', 1),
  (1, '实名认证服务协议', 'v1.8', 'signed', '2026-09-12T20:36:00', 2),
  (1, 'INU 余额支付协议', 'v3.1', 'signed', '2026-08-30T10:02:00', 3),
  (1, '积分商城交易规则', 'v2.0', 'pending', NULL, 4),
  (1, '隐私政策', 'v4.2', 'signed', '2026-07-18T15:44:00', 5),
  (1, '普通会员服务协议', 'v1.2', 'pending', NULL, 6),
  (1, '登录设备安全规范', 'v1.1', 'signed', '2026-06-05T09:18:00', 7);

INSERT INTO orders (user_id, code, product_id, item, energy_cents, status, created_at) VALUES
  (1, 'INU-1030-0721', 'dust-pack', 'INU 帆布袋 ×1', 12800, 'transit', '2026-10-30T18:30:00'),
  (1, 'INU-1028-1208', 'coffee-beans', '咖啡豆 ×2', 9600, 'delivered', '2026-10-28T12:08:00'),
  (1, 'INU-1024-0912', 'star-projector', '桌面氛围灯 ×1', 26800, 'delivered', '2026-10-24T09:12:00'),
  (1, 'INU-1020-0417', 'dust-badge', '帆布袋 · 限定', 6800, 'pending_payment', '2026-10-20T04:17:00'),
  (1, 'INU-1018-2205', 'coffee-beans', '咖啡豆 ×1', 4800, 'delivered', '2026-10-18T22:05:00'),
  (1, 'INU-1012-1030', 'dust-pack', 'INU 帆布袋 ×2', 25600, 'delivered', '2026-10-12T10:30:00');

INSERT INTO notification_prefs (user_id, key, enabled) VALUES
  (1, 'type_security', 1),
  (1, 'type_supply', 1),
  (1, 'type_energy', 1),
  (1, 'type_member', 0),
  (1, 'type_radio', 0),
  (1, 'channel_inapp', 1),
  (1, 'channel_email', 1),
  (1, 'channel_push', 1);

INSERT INTO notification_settings (user_id, dnd_enabled, dnd_start, dnd_end, digest_enabled) VALUES
  (1, 0, '22:00', '08:00', 1);
