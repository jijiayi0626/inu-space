import { reactive } from 'vue';

export const toastState = reactive({
  show: false,
  message: '',
  tone: 'success',
});

let timer = null;

export function toast(message, tone = 'success', duration = 2600) {
  if (timer) clearTimeout(timer);
  toastState.message = message;
  toastState.tone = tone;
  toastState.show = true;
  timer = setTimeout(() => {
    toastState.show = false;
    timer = null;
  }, duration);
}

export function dismissToast() {
  if (timer) clearTimeout(timer);
  timer = null;
  toastState.show = false;
}
