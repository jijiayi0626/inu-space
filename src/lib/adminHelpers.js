import { toast } from './toast';

export const NOTIFICATION_CATEGORIES = [
  { key: 'type_security', label: '账户安全提醒' },
  { key: 'type_supply', label: '商城动态' },
  { key: 'type_energy', label: '余额变动' },
  { key: 'type_member', label: '会员权益与等级' },
  { key: 'type_radio', label: '活动与公告' },
];

export const ORDER_STATUS_OPTIONS = [
  { key: 'pending_payment', label: '待支付' },
  { key: 'transit', label: '配送中' },
  { key: 'delivered', label: '已签收' },
  { key: 'cancelled', label: '已取消' },
];

export const ORDER_STATUS_TONES = {
  pending_payment: 'badge-orange',
  transit: 'badge-blue',
  delivered: 'badge-green',
  cancelled: 'badge-gray',
};

export const WITHDRAW_STATUS = {
  processing: { label: '待复核', tone: 'badge-orange' },
  paid: { label: '已打款', tone: 'badge-green' },
  rejected: { label: '已驳回', tone: 'badge-gray' },
};

export const TONES = ['blue', 'purple', 'cyan', 'green', 'orange'];

export const PRODUCT_ICONS = ['i-box', 'i-chart', 'i-star', 'i-wallet', 'i-file', 'i-device', 'i-lock', 'i-idcard', 'i-clock', 'i-grid'];

export function sourceLabel(source) {
  if (source === 'db') return '管理台配置';
  if (source === 'env') return '环境变量';
  return '未配置';
}

export function bareIcon(value) {
  return String(value || 'box').replace(/^i-/, '');
}

export function orderStatusLabel(status) {
  return ORDER_STATUS_OPTIONS.find((item) => item.key === status)?.label || status;
}

export function stockLabel(stock) {
  return Number(stock) < 0 ? '不限' : Number(stock);
}

export async function copyText(value, label = '已复制') {
  const text = String(value || '');
  if (!text) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
    }
    toast(label);
  } catch {
    toast('复制失败，请手动选择文本', 'error');
  }
}
