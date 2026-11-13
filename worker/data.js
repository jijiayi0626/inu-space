// 会员等级、权益、商品货架等相对静态的业务数据。
// 放在 Worker 侧统一返回，前端无需再发额外请求。

export const TIERS = [
  {
    key: 'basic',
    label: '普通',
    en: 'BASIC',
    min: 0,
    discount: '95 折',
    rate: 0.95,
    desc: '注册即可享基础权益，积分与订单实时同步。',
    icon: 'i-user',
  },
  {
    key: 'silver',
    label: '白银',
    en: 'SILVER',
    min: 10000,
    discount: '9 折',
    rate: 0.9,
    desc: '累计 10,000 积分，商品折扣与积分加速同步提升。',
    icon: 'i-star',
  },
  {
    key: 'gold',
    label: '黄金',
    en: 'GOLD',
    min: 50000,
    discount: '85 折',
    rate: 0.85,
    desc: '累计 50,000 积分，享受更高折扣与优先客服。',
    icon: 'i-star',
  },
  {
    key: 'platinum',
    label: '铂金',
    en: 'PLATINUM',
    min: 200000,
    discount: '8 折',
    rate: 0.8,
    desc: '累计 200,000 积分，专属顾问与生日礼遇。',
    icon: 'i-globe',
  },
];

export const TIER_MAP = Object.fromEntries(TIERS.map((t) => [t.key, t]));

export const BENEFITS = [
  {
    key: 'supply-discount',
    icon: 'i-box',
    title: '商品折扣',
    desc: '积分商城全部商品享会员折扣，结算时自动抵扣。',
    min: 0,
  },
  {
    key: 'particle-boost',
    icon: 'i-chart',
    title: '积分加速',
    desc: '每日任务获得的积分额外 +5%。',
    min: 0,
  },
  {
    key: 'support',
    icon: 'i-message',
    title: '专属客服',
    desc: '7×24 小时在线，平均 30 秒内响应。',
    min: 0,
  },
  {
    key: 'birthday',
    icon: 'i-star',
    title: '生日礼遇',
    desc: '每年生日当月赠送 500 积分，可叠加使用。',
    min: 10000,
  },
];

// 商城默认清空，商品统一由管理后台配置，避免空库时回退到演示数据。
export const PRODUCTS = [];


export const NOTIFICATION_TYPES = [
  { key: 'type_security', title: '账户安全提醒', sub: '新设备登录、密码变更与异常操作' },
  { key: 'type_supply', title: '订单动态', sub: '订单状态、物流进度与售后结果' },
  { key: 'type_energy', title: '余额变动', sub: '充值到账、消费与提现结果' },
  { key: 'type_member', title: '会员权益与等级', sub: '等级变化、积分到期与专属权益' },
  { key: 'type_radio', title: '活动与公告', sub: '版本更新、限时活动与产品说明' },
];

export const NOTIFICATION_CHANNELS = [
  { key: 'channel_inapp', icon: 'i-bell', title: '站内信', sub: '在 INU 账号内接收即时提醒' },
  { key: 'channel_email', icon: 'i-mail', title: '邮箱', sub: '安全邮箱 · 已验证' },
  { key: 'channel_sms', icon: 'i-phone', title: '短信', sub: '绑定手机号后接收关键安全提醒' },
  { key: 'channel_push', icon: 'i-device', title: '设备推送', sub: '向已登录的设备推送' },
];

export const SUPPLY_TIPS = [
  { icon: 'i-chart', text: '积分与余额相互独立：积分用于等级与积分商品，余额用于充值、提现与余额商品。' },
  { icon: 'i-box', text: '实物商品需完成实名认证并填写收货地址，预计 1–3 个工作日送达。' },
  { icon: 'i-wallet', text: '余额可按站点设置的比例兑换为积分，兑换后不可退回。' },
  { icon: 'i-star', text: '会员与应用权益购买后立即生效，无需等待物流。' },
];

export const SECURITY_ADVICE = [
  { icon: 'i-lock', text: '避免在多个站点复用同一密码。' },
  { icon: 'i-shield', text: '开启两步验证，动态码不要转发给任何人。' },
  { icon: 'i-device', text: '定期检查登录设备列表，移除不认识的设备。' },
];
