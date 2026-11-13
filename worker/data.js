// 会员等级、权益、商品货架等相对静态的业务数据。
// 放在 Worker 侧统一返回，前端无需再发额外请求。

export const TIERS = [
  {
    key: 'basic',
    label: '普通',
    en: 'BASIC',
    min: 0,
    discount: '无折扣',
    rate: 1,
    exchangeBonus: 0,
    desc: '注册即可使用，积分与订单实时同步，无会员折扣。',
    icon: 'i-user',
  },
  {
    key: 'silver',
    label: '白银',
    en: 'SILVER',
    min: 2000,
    discount: '98 折',
    rate: 0.98,
    exchangeBonus: 0.02,
    desc: '累计 2,000 积分，商城 98 折，余额兑换积分 +2%。',
    icon: 'i-star',
  },
  {
    key: 'gold',
    label: '黄金',
    en: 'GOLD',
    min: 10000,
    discount: '95 折',
    rate: 0.95,
    exchangeBonus: 0.05,
    desc: '累计 10,000 积分，商城 95 折，兑换积分 +5%。',
    icon: 'i-star',
  },
  {
    key: 'platinum',
    label: '铂金',
    en: 'PLATINUM',
    min: 30000,
    discount: '92 折',
    rate: 0.92,
    exchangeBonus: 0.08,
    desc: '累计 30,000 积分，商城 92 折，兑换积分 +8%，享专属客服。',
    icon: 'i-grid',
  },
  {
    key: 'diamond',
    label: '钻石',
    en: 'DIAMOND',
    min: 80000,
    discount: '9 折',
    rate: 0.9,
    exchangeBonus: 0.1,
    desc: '累计 80,000 积分，商城 9 折，兑换积分 +10%。',
    icon: 'i-grid',
  },
  {
    key: 'black',
    label: '黑钻',
    en: 'BLACK',
    min: 200000,
    discount: '85 折',
    rate: 0.85,
    exchangeBonus: 0.15,
    desc: '累计 200,000 积分，商城 85 折，兑换积分 +15%，专属客服优先响应。',
    icon: 'i-globe',
  },
];


export const TIER_MAP = Object.fromEntries(TIERS.map((t) => [t.key, t]));

export const BENEFITS = [
  {
    key: 'supply-discount',
    icon: 'i-box',
    title: '商城折扣',
    desc: '白银及以上享 98 折起会员价，积分商品与余额商品结算时自动抵扣。',
    min: 2000,
  },
  {
    key: 'points-bonus',
    icon: 'i-chart',
    title: '兑换积分加成',
    desc: '用余额兑换积分时额外获得 2%–15% 积分，等级越高加成越多。',
    min: 2000,
  },
  {
    key: 'support',
    icon: 'i-message',
    title: '专属客服',
    desc: '铂金及以上享专属客服通道，工作日 2 小时内响应。',
    min: 30000,
  },
  {
    key: 'member-card',
    icon: 'i-star',
    title: '付费会员',
    desc: '可在积分商城购买 12 个月会员卡，立即生效，到期后恢复成长等级。',
    min: 0,
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
  { icon: 'i-star', text: '会员与应用权益无需实名认证，购买后立即生效；付费会员卡按有效期计算。' },
];

export const SECURITY_ADVICE = [
  { icon: 'i-lock', text: '避免在多个站点复用同一密码。' },
  { icon: 'i-shield', text: '开启两步验证，动态码不要转发给任何人。' },
  { icon: 'i-device', text: '定期检查登录设备列表，移除不认识的设备。' },
];
