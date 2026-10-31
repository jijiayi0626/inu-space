// 会员等级、权益、补给货架等相对静态的业务数据。
// 放在 Worker 侧统一返回，前端无需再发额外请求。

export const TIERS = [
  {
    key: 'stardust',
    label: '星尘',
    en: 'STARDUST',
    min: 0,
    discount: '95 折',
    rate: 0.95,
    desc: '穿越星云的旅人，你的每一次探索，都在为这片宇宙点亮新的坐标。',
    icon: 'i-spark',
  },
  {
    key: 'planet',
    label: '行星',
    en: 'PLANET',
    min: 10000,
    discount: '9 折',
    rate: 0.9,
    desc: '拥有稳定轨道的探索者，补给与权益开始围绕你运转。',
    icon: 'i-orbit',
  },
  {
    key: 'star',
    label: '恒星',
    en: 'STAR',
    min: 50000,
    discount: '85 折',
    rate: 0.85,
    desc: '自带光芒的星际公民，你的坐标被更多舰队看见。',
    icon: 'i-star',
  },
  {
    key: 'galaxy',
    label: '星系',
    en: 'GALAXY',
    min: 200000,
    discount: '8 折',
    rate: 0.8,
    desc: '你已成为一片星系的引力中心，拥有专属星际顾问。',
    icon: 'i-globe',
  },
];

export const TIER_MAP = Object.fromEntries(TIERS.map((t) => [t.key, t]));

export const BENEFITS = [
  {
    key: 'supply-discount',
    icon: 'i-box',
    title: '星际补给折扣',
    desc: '补给站全部物资享 95 折，星能结算自动抵扣。',
    min: 0,
  },
  {
    key: 'particle-boost',
    icon: 'i-spark',
    title: '粒子加速',
    desc: '每日任务获得的 INU 粒子额外 +5%。',
    min: 0,
  },
  {
    key: 'support',
    icon: 'i-message',
    title: '专属客服',
    desc: '7×24 小时星际通道，平均 30 秒内响应。',
    min: 0,
  },
  {
    key: 'birthday',
    icon: 'i-star',
    title: '生日星能',
    desc: '每年生日当月赠送 500 星能，可叠加使用。',
    min: 10000,
  },
];

export const PRODUCTS = [
  {
    id: 'dust-pack',
    name: '星尘补给包',
    desc: '随机星尘徽章、航线贴纸与一张未知星图。',
    priceCents: 12800,
    icon: 'i-box',
    tag: '人气',
    tone: 'blue',
  },
  {
    id: 'coffee-beans',
    name: '星际咖啡豆',
    desc: '低轨道慢速烘焙，柑橘与可可的尾韵。',
    priceCents: 9600,
    icon: 'i-orbit',
    tag: '补给',
    tone: 'orange',
  },
  {
    id: 'star-projector',
    name: '星图投影灯',
    desc: '把猎户座悬在卧室天花板，今晚即达。',
    priceCents: 26800,
    icon: 'i-star',
    tag: '限定',
    tone: 'purple',
  },
];

export const NOTIFICATION_TYPES = [
  { key: 'type_security', title: '账户安全提醒', sub: '新终端登录、密码变更与异常操作' },
  { key: 'type_supply', title: '星际补给动态', sub: '订单状态、物流轨迹与跃迁进度' },
  { key: 'type_energy', title: '星能变动', sub: '充值到账、消费与提现结果' },
  { key: 'type_member', title: '会员权益与等级', sub: '等级变化、粒子到期与专属权益' },
  { key: 'type_radio', title: '星际电台与活动', sub: '版本更新、限时活动与宇宙见闻' },
];

export const NOTIFICATION_CHANNELS = [
  { key: 'channel_inapp', icon: 'i-bell', title: '站内信', sub: '在星际通行证内接收即时提醒' },
  { key: 'channel_email', icon: 'i-mail', title: '邮箱', sub: '安全邮箱 · 已验证' },
  { key: 'channel_sms', icon: 'i-phone', title: '短信', sub: '绑定手机号后接收关键安全提醒' },
  { key: 'channel_push', icon: 'i-device', title: '星际终端推送', sub: '向已绑定的可信终端推送' },
];

export const SUPPLY_TIPS = [
  { icon: 'i-box', text: '星尘会员全场 95 折，结算时自动抵扣。' },
  { icon: 'i-clock', text: '跃迁中的订单预计 1–3 个星际日送达。' },
  { icon: 'i-spark', text: '补给消费可累计 INU 粒子，100 星能返 5 粒子。' },
  { icon: 'i-shield', text: '未实名账号暂不可下单，请先完成认证。' },
];

export const SECURITY_ADVICE = [
  { icon: 'i-lock', text: '避免在多个星际站点复用同一密码。' },
  { icon: 'i-shield', text: '开启两步验证，动态码不要转发给任何人。' },
  { icon: 'i-device', text: '定期检查星际终端列表，移除不认识的设备。' },
];
