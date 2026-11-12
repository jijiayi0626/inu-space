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
    desc: '每年生日当月赠送 500 余额，可叠加使用。',
    min: 10000,
  },
];

export const PRODUCTS = [
  {
    id: 'dust-pack',
    name: 'INU 帆布袋',
    desc: '加厚棉布，通勤与日常购物都合适。',
    priceCents: 12800,
    icon: 'i-box',
    tag: '人气',
    tone: 'blue',
  },
  {
    id: 'coffee-beans',
    name: '挂耳咖啡',
    desc: '中度烘焙，柑橘与可可风味，十包装。',
    priceCents: 9600,
    icon: 'i-box',
    tag: '新品',
    tone: 'orange',
  },
  {
    id: 'star-projector',
    name: '桌面氛围灯',
    desc: '三档色温，触摸调光，适合书桌与床头。',
    priceCents: 26800,
    icon: 'i-star',
    tag: '限定',
    tone: 'purple',
  },
];

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
  { icon: 'i-box', text: '普通会员全场 95 折，结算时自动抵扣。' },
  { icon: 'i-clock', text: '已提交的订单预计 1–3 个工作日送达。' },
  { icon: 'i-chart', text: '商城消费可累计积分，100 余额返 5 积分。' },
  { icon: 'i-shield', text: '未实名账号暂不可下单，请先完成认证。' },
];

export const SECURITY_ADVICE = [
  { icon: 'i-lock', text: '避免在多个站点复用同一密码。' },
  { icon: 'i-shield', text: '开启两步验证，动态码不要转发给任何人。' },
  { icon: 'i-device', text: '定期检查登录设备列表，移除不认识的设备。' },
];
