-- 把历史种子数据中的科幻文案改为中性表述，可重复执行。

UPDATE app_settings SET value = '© 2026 INU 账号中心' WHERE key = 'site.footer_text';
UPDATE app_settings SET value = '登录后继续管理你的资料与安全。' WHERE key = 'site.login_welcome';

UPDATE users SET bio = '把日常过得简单一点，记录每一次小小的进步。'
WHERE email = 'xiaoyiyi@inu.space' AND bio = '在星云与星尘之间，收集每一次微小的光。';
UPDATE users SET display_name = '管理员', region = ''
WHERE email = 'admin@inu.space' AND display_name = '星际管理员';

UPDATE activities SET
  title = '余额充值到账',
  detail = '+200.00 余额 · 支付',
  icon = 'i-wallet'
WHERE title = '星能充值到账';
UPDATE activities SET title = '签署《服务协议》' WHERE title = '签署《星际航行服务协议》';
UPDATE activities SET title = '签署《积分商城交易规则》' WHERE title = '签署《星际补给站交易规则》';
UPDATE activities SET title = '签署《普通会员服务协议》' WHERE title = '签署《星尘会员服务协议》';
UPDATE activities SET title = '完成实名认证', detail = '积分商城下单与余额提现已解锁'
WHERE title = '完成星际公民认证';
UPDATE activities SET title = '新设备验证通过' WHERE title = '新终端验证通过';
UPDATE activities SET icon = 'i-wallet' WHERE icon = 'i-spark';

UPDATE security_logs SET event = '实名认证完成' WHERE event = '星际公民认证完成';
UPDATE security_logs SET event = '其他设备已退出' WHERE event = '其余终端已退出';
UPDATE security_logs SET event = '新设备验证通过' WHERE event = '新终端验证通过';
UPDATE security_logs SET detail = REPLACE(detail, '星际终端', '登录设备') WHERE detail LIKE '%星际终端%';
UPDATE security_logs SET detail = REPLACE(detail, 'Windows 终端', 'Windows 电脑') WHERE detail LIKE '%Windows 终端%';

UPDATE particle_logs SET label = '每日签到' WHERE label = '每日星际签到';
UPDATE particle_logs SET label = '积分商城消费' WHERE label = '星际补给站消费';
UPDATE particle_logs SET label = '签署《服务协议》' WHERE label = '签署《星际航行服务协议》';
UPDATE particle_logs SET label = '签署《积分商城交易规则》' WHERE label = '签署《星际补给站交易规则》';
UPDATE particle_logs SET label = '签署《普通会员服务协议》' WHERE label = '签署《星尘会员服务协议》';

UPDATE products SET name = 'INU 帆布袋', desc = '加厚棉布，通勤与日常购物都合适。', tag = '人气', icon = 'i-box'
WHERE id = 'dust-pack';
UPDATE products SET name = '挂耳咖啡', desc = '中度烘焙，柑橘与可可风味，十包装。', tag = '新品', icon = 'i-box'
WHERE id = 'coffee-beans';
UPDATE products SET name = '桌面氛围灯', desc = '三档色温，触摸调光，适合书桌与床头。', tag = '限定', icon = 'i-star'
WHERE id = 'star-projector';

UPDATE orders SET item = 'INU 帆布袋 ×1' WHERE product_id = 'dust-pack' AND item LIKE '%星尘补给包%×1%';
UPDATE orders SET item = 'INU 帆布袋 ×2' WHERE product_id = 'dust-pack' AND item LIKE '%星尘补给包%×2%';
UPDATE orders SET item = '挂耳咖啡 ×2' WHERE product_id = 'coffee-beans' AND item LIKE '%星际咖啡豆%×2%';
UPDATE orders SET item = '挂耳咖啡 ×1' WHERE product_id = 'coffee-beans' AND item LIKE '%星际咖啡豆%×1%';
UPDATE orders SET item = '桌面氛围灯 ×1' WHERE product_id = 'star-projector' AND item LIKE '%星图投影灯%';
UPDATE orders SET item = 'INU 徽章 · 限定' WHERE product_id = 'dust-badge' AND item LIKE '%星尘徽章%';

UPDATE notification_messages SET title = '新设备登录提醒',
  body = 'iPhone 15 Pro 于杭州完成登录，如非本人操作请立即修改密码。'
WHERE title = '新终端登录提醒';
UPDATE notification_messages SET title = '订单已发货',
  body = '订单 INU-1030-0721 已支付，预计 1–3 个工作日送达。'
WHERE title = '补给已进入跃迁队列';
UPDATE notification_messages SET title = '余额充值到账',
  body = '+200.00 余额已存入账户，可在余额明细中查看。'
WHERE title = '星能充值到账';

UPDATE agreement_templates SET title = '服务协议',
  content = '一、协议范围
本协议是你与 INU 关于账号、账户余额与基础服务的约定。

二、账号与安全
你应妥善保管登录凭据，开启两步验证，并对账号下的操作负责。发现异常登录时应立即修改密码并移除陌生设备。

三、服务使用
INU 账号仅用于合法合规的业务与第三方应用接入。禁止利用服务进行欺诈、攻击、批量注册或干扰他人正常使用。

四、变更与终止
我们可能根据服务运行情况调整服务内容，重大变更会通过站内信或安全邮箱提前通知。

五、生效
签署后本协议立即生效，签署记录将写入协议库。'
WHERE id = 1;

UPDATE agreement_templates SET title = '实名认证服务协议',
  content = '一、认证目的
为解锁积分商城下单、余额提现等能力，你需要完成实名认证。

二、信息范围
认证信息仅用于身份核验与安全风控，遵循最小必要原则，不会用于与认证无关的用途。

三、你的承诺
你确认提交的认证信息真实、有效，且由本人操作。冒用他人身份将导致账号被限制。

四、数据保护
认证数据采用加密存储，仅授权风控人员在必要范围内访问，并保留操作审计记录。

五、生效
完成勾选并提交后，本协议立即生效。'
WHERE id = 2;

UPDATE agreement_templates SET title = '余额支付协议',
  content = '一、余额说明
余额是 INU 账户内的记账单位，用于兑换商品与生态服务，不代表法定货币。

二、充值与到账
充值订单创建后以支付渠道回调为准，到账后写入钱包流水。异常订单会在 1–3 个工作日内自动核对。

三、消费与退款
消费时优先扣除账户余额；退款按原路退回余额，具体到账时间以页面提示为准。

四、安全
请勿向他人透露支付信息。发现异常扣款时，应立即修改密码并联系 support@inu.space。

五、生效
签署后本协议生效。'
WHERE id = 3;

UPDATE agreement_templates SET title = '积分商城交易规则',
  content = '一、下单条件
完成实名认证后可兑换商品，收货地址需填写完整且真实有效。

二、价格与折扣
会员折扣在结算时自动生效，页面展示的会员价为最终余额价格。

三、物流与签收
订单支付后进入配送流程，预计 1–3 个工作日送达，签收后可在订单详情查看记录。

四、售后
商品存在质量问题时可联系客服处理，具体以订单页说明为准。

五、生效
签署后本规则生效。'
WHERE id = 4;

UPDATE agreement_templates SET title = '隐私政策',
  content = '一、收集范围
我们收集账号资料、登录设备、订单与余额流水，用于提供账号服务与保障账号安全。

二、使用方式
信息用于身份核验、风控、订单履约与服务通知，不会出售给第三方。

三、共享与披露
仅在完成订单履约、遵守法律要求或获得你明确同意时共享必要信息。

四、你的权利
你可以访问、更正或删除个人资料，也可以申请导出协议签署记录。

五、联系方式
隐私相关问题可通过站内信或 support@inu.space 联系法务团队。'
WHERE id = 5;

UPDATE agreement_templates SET title = '普通会员服务协议',
  content = '一、会员等级
普通、白银、黄金与铂金等级由积分累计决定，等级权益在会员中心展示。

二、积分获取
签署协议、完成商品消费与参与活动可获得积分，具体以页面规则为准。

三、权益使用
会员折扣、专属客服与生日余额等权益仅限本人账号使用，不可转让。

四、等级调整
积分有效期与等级计算规则可能调整，调整前会通过公告说明。

五、生效
签署后本协议生效，并同步更新你的会员档案。'
WHERE id = 6;

UPDATE agreement_templates SET title = '登录设备安全规范',
  content = '一、可信设备
只有通过安全验证的设备才会被标记为可信，登录记录可在登录设备页面查看。

二、设备管理
发现陌生设备应立即解绑并修改密码，30 天未活跃的设备会被标记为待清理。

三、验证要求
新设备首次登录需要完成二次验证，敏感操作需要再次确认。

四、通知
新设备登录、密码变更与异常操作会通过站内信或安全邮箱提醒。

五、生效
签署后本规范生效。'
WHERE id = 7;

UPDATE agreements SET title = '服务协议',
  content = (SELECT content FROM agreement_templates WHERE id = 1)
WHERE title = '星际航行服务协议';
UPDATE agreements SET title = '实名认证服务协议',
  content = (SELECT content FROM agreement_templates WHERE id = 2)
WHERE title = '星际公民认证服务协议';
UPDATE agreements SET title = '余额支付协议',
  content = (SELECT content FROM agreement_templates WHERE id = 3)
WHERE title = 'INU 星能支付协议';
UPDATE agreements SET title = '积分商城交易规则',
  content = (SELECT content FROM agreement_templates WHERE id = 4)
WHERE title = '星际补给站交易规则';
UPDATE agreements SET content = (SELECT content FROM agreement_templates WHERE id = 5)
WHERE title = '隐私政策';
UPDATE agreements SET title = '普通会员服务协议',
  content = (SELECT content FROM agreement_templates WHERE id = 6)
WHERE title = '星尘会员服务协议';
UPDATE agreements SET title = '登录设备安全规范',
  content = (SELECT content FROM agreement_templates WHERE id = 7)
WHERE title = '星际终端设备安全规范';

UPDATE admin_audit_logs SET detail = REPLACE(detail, '星际', '') WHERE detail LIKE '%星际%';
UPDATE admin_audit_logs SET detail = REPLACE(detail, '终端', '设备') WHERE detail LIKE '%终端%';
