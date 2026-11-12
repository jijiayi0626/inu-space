import { Message } from 'fuxsto-design-pro';

const TONES = {
  success: 'success',
  error: 'error',
  warning: 'warning',
  info: 'info',
};

export function toast(message, tone = 'success', duration = 2600) {
  const method = Message[TONES[tone] || 'success'];
  return method(message, { duration });
}

export function dismissToast() {
  Message.closeAll();
}
