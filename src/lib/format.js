const pad = (value) => String(value).padStart(2, '0');

function parse(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function number(value) {
  return Number(value || 0).toLocaleString('zh-CN');
}

export function money(cents) {
  return (Number(cents || 0) / 100).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function moneyParts(cents) {
  const [integer, decimal] = money(cents).split('.');
  return { integer, decimal };
}

export function timeLabel(value) {
  const date = parse(value);
  if (!date) return '—';
  const now = new Date();
  const hm = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return `今天 ${hm}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  if (isYesterday) return `昨天 ${hm}`;

  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${hm}`;
}

export function dateTimeLabel(value) {
  const date = parse(value);
  if (!date) return '—';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function dateLabel(value) {
  const date = parse(value);
  if (!date) return '—';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function daysAgo(value) {
  const date = parse(value);
  if (!date) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

export function relativeDays(value) {
  const date = parse(value);
  if (!date) return '—';
  const diff = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (diff <= 0) return '今天';
  if (diff === 1) return '昨天';
  if (diff < 30) return `${diff} 天前`;
  if (diff < 365) return `${Math.floor(diff / 30)} 个月前`;
  return `${Math.floor(diff / 365)} 年前`;
}

export function maskPhone(phone) {
  if (!phone) return '';
  return phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}
