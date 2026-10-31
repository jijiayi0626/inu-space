import { ref } from 'vue';

const initial =
  typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark'
    ? 'dark'
    : 'light';

export const theme = ref(initial);

export function applyTheme(value) {
  theme.value = value;
  document.documentElement.setAttribute('data-theme', value);
  try {
    localStorage.setItem('inu-theme', value);
  } catch {
    /* 忽略隐私模式下的存储异常 */
  }
}

export function toggleTheme() {
  applyTheme(theme.value === 'dark' ? 'light' : 'dark');
}
