-- 0005 · 钱包、验证码、协议模板、订单物流、通知收件箱与商品配置
-- 所有新增字段都带有安全默认值，可重复执行时请忽略 duplicate column 报错。

ALTER TABLE users ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN avatar_tone TEXT NOT NULL DEFAULT 'blue';
ALTER TABLE users ADD COLUMN display_name_changed_at TEXT;

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  amount_cents INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  ref TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON wallet_transactions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS recharge_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  code TEXT NOT NULL UNIQUE,
  amount_cents INTEGER NOT NULL,
  method TEXT NOT NULL DEFAULT 'inu_pay',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_recharge_orders_user ON recharge_orders(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  code TEXT NOT NULL UNIQUE,
  amount_cents INTEGER NOT NULL,
  account TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  processed_at TEXT,
  processed_by INTEGER
);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS verification_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  purpose TEXT NOT NULL,
  target TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_verification_codes_user ON verification_codes(user_id, purpose, created_at DESC);

ALTER TABLE agreements ADD COLUMN content TEXT NOT NULL DEFAULT '';
ALTER TABLE agreements ADD COLUMN reward INTEGER NOT NULL DEFAULT 50;
ALTER TABLE agreements ADD COLUMN template_id INTEGER;

CREATE TABLE IF NOT EXISTS agreement_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL UNIQUE,
  version TEXT NOT NULL,
  content TEXT NOT NULL,
  reward INTEGER NOT NULL DEFAULT 50,
  sort INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

ALTER TABLE orders ADD COLUMN address TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN tracking_no TEXT;
ALTER TABLE orders ADD COLUMN carrier TEXT;
ALTER TABLE orders ADD COLUMN updated_at TEXT;
ALTER TABLE orders ADD COLUMN paid_at TEXT;
ALTER TABLE orders ADD COLUMN delivered_at TEXT;
ALTER TABLE orders ADD COLUMN cancelled_at TEXT;

CREATE TABLE IF NOT EXISTS notification_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  category TEXT NOT NULL DEFAULT 'type_security',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT NOT NULL DEFAULT '',
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notification_messages_user ON notification_messages(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  desc TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL,
  icon TEXT NOT NULL DEFAULT 'i-box',
  tag TEXT NOT NULL DEFAULT '',
  tone TEXT NOT NULL DEFAULT 'blue',
  stock INTEGER NOT NULL DEFAULT -1,
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO products (id, name, desc, price_cents, icon, tag, tone, stock, active, sort, updated_at) VALUES
  ('dust-pack', '星尘补给包', '随机星尘徽章、航线贴纸与一张未知星图。', 12800, 'i-box', '人气', 'blue', -1, 1, 1, datetime('now')),
  ('coffee-beans', '星际咖啡豆', '低轨道慢速烘焙，柑橘与可可的尾韵。', 9600, 'i-orbit', '补给', 'orange', -1, 1, 2, datetime('now')),
  ('star-projector', '星图投影灯', '把猎户座悬在卧室天花板，今晚即达。', 26800, 'i-star', '限定', 'purple', -1, 1, 3, datetime('now'));

INSERT OR IGNORE INTO agreement_templates (title, version, content, reward, sort, active, updated_at) VALUES
  ('星际航行服务协议', 'v2.4', '一、协议范围\n本协议是你与 INU 无限宇宙之间关于星际通行证、星际钱包与基础航行服务的约定。\n\n二、账号与安全\n你应妥善保管登录凭据，开启两步验证，并对账号下的操作负责。发现异常登录时应立即修改密码并解绑陌生终端。\n\n三、服务使用\n星际通行证仅用于合法合规的星际探索与生态应用接入。禁止利用服务进行欺诈、攻击、批量注册或干扰他人正常使用。\n\n四、变更与终止\n我们可能根据星际网络运行情况调整服务内容，重大变更会通过站内信或安全邮箱提前通知。\n\n五、生效\n签署后本协议立即生效，签署记录将写入星际法条库。', 50, 1, 1, datetime('now')),
  ('星际公民认证服务协议', 'v1.8', '一、认证目的\n为解锁星际补给站下单、星能提现等能力，你需要完成星际公民身份认证。\n\n二、信息范围\n认证信息仅用于身份核验与安全风控，遵循最小必要原则，不会用于与认证无关的用途。\n\n三、你的承诺\n你确认提交的认证信息真实、有效，且由本人操作。冒用他人身份将导致账号被限制。\n\n四、数据保护\n认证数据采用加密存储，仅授权风控人员在必要范围内访问，并保留操作审计记录。\n\n五、生效\n完成勾选并提交后，本协议立即生效。', 50, 2, 1, datetime('now')),
  ('INU 星能支付协议', 'v3.1', '一、星能说明\n星能是 INU 星际钱包内的记账单位，用于兑换补给与生态服务，不代表法定货币。\n\n二、充值与到账\n充值订单创建后以支付渠道回调为准，到账后写入钱包流水。异常订单会在 1–3 个星际日内自动核对。\n\n三、消费与退款\n补给兑换成功后星能立即扣除。未发货订单可申请取消，退款将原路退回星际钱包。\n\n四、提现\n提现需完成实名认证并绑定手机号，提交后进入人工复核，结果通过站内信通知。\n\n五、风险提示\n请勿向他人透露支付凭据，任何索要验证码的行为都应视为风险。', 50, 3, 1, datetime('now')),
  ('星际补给站交易规则', 'v2.0', '一、下单条件\n完成星际公民认证后可兑换补给，收货坐标需填写完整且真实有效。\n\n二、价格与折扣\n会员折扣在结算时自动生效，页面展示的会员价为最终星能价格。\n\n三、物流与签收\n补给进入跃迁队列后预计 1–3 个星际日送达，签收后可在订单详情确认收货。\n\n四、取消与售后\n待支付订单可直接取消；已支付订单如需售后，请通过客服通道提交订单编号。\n\n五、违规处理\n恶意下单、虚假收货信息或滥用退款将导致补给权限被限制。', 50, 4, 1, datetime('now')),
  ('隐私政策', 'v4.2', '一、收集范围\n我们收集账号资料、登录设备、订单与钱包流水，用于提供通行证服务与保障账号安全。\n\n二、使用方式\n信息用于身份核验、风控、订单履约与服务通知，不会出售给第三方。\n\n三、共享与披露\n仅在完成订单履约、遵守法律要求或获得你明确同意时共享必要信息。\n\n四、你的权利\n你可以访问、更正或删除个人资料，也可以申请导出协议签署记录。\n\n五、联系方式\n隐私相关问题可通过站内信或 support@inu.space 联系星际法务终端。', 50, 5, 1, datetime('now')),
  ('星尘会员服务协议', 'v1.2', '一、会员等级\n星尘、行星、恒星与星系等级由 INU 粒子累计决定，等级权益在会员中心展示。\n\n二、粒子获取\n签署协议、完成补给消费与参与星际活动可获得粒子，具体以页面规则为准。\n\n三、权益使用\n会员折扣、专属客服与生日星能等权益仅限本人账号使用，不可转让。\n\n四、等级调整\n粒子有效期与等级计算规则可能调整，调整前会通过公告说明。\n\n五、生效\n签署后本协议生效，并同步更新你的会员档案。', 50, 6, 1, datetime('now')),
  ('星际终端设备安全规范', 'v1.1', '一、可信终端\n只有通过安全验证的终端才会被标记为可信，登录记录可在星际终端页面查看。\n\n二、终端管理\n发现陌生终端应立即解绑并修改密码，30 天未活跃的终端会被标记为待清理。\n\n三、验证要求\n新终端首次登录需要完成二次验证，敏感操作可能触发额外确认。\n\n四、责任边界\n因终端丢失或凭据泄露导致的损失，由账号持有人承担相应责任。\n\n五、生效\n签署后本规范适用于你账号下的全部终端。', 50, 7, 1, datetime('now'));

INSERT OR IGNORE INTO notification_messages (id, user_id, category, title, body, link, read_at, created_at) VALUES
  (1, 1, 'type_security', '新终端登录提醒', 'iPhone 15 Pro 于杭州完成登录，如非本人操作请立即修改密码。', '/devices', NULL, '2026-10-30T22:41:00'),
  (2, 1, 'type_supply', '补给已进入跃迁队列', '订单 INU-1030-0721 已支付，预计 1–3 个星际日送达。', '/supply', NULL, '2026-10-30T18:30:00'),
  (3, 1, 'type_energy', '星能充值到账', '+200.00 星能已存入星际钱包，可在星能明细中查看。', '/supply', '2026-10-30T21:10:00', '2026-10-30T21:04:00');
