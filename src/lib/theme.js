import { ref } from 'vue';

const STORAGE_KEY = 'inu-theme';
const darkQuery =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

function readPreference() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    /* 忽略隐私模式下的存储异常 */
  }
  return 'system';
}

function resolve(preference) {
  if (preference === 'light' || preference === 'dark') return preference;
  return darkQuery?.matches ? 'dark' : 'light';
}

// 默认跟随系统；用户手动切换后记住明确选择。
const themePreference = ref(typeof window === 'undefined' ? 'light' : readPreference());
export const theme = ref(resolve(themePreference.value));

export function applyTheme(value) {
  const preference = value === 'light' || value === 'dark' ? value : 'system';
  themePreference.value = preference;
  theme.value = resolve(preference);
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    /* 忽略隐私模式下的存储异常 */
  }
}

export function toggleTheme() {
  applyTheme(theme.value === 'dark' ? 'light' : 'dark');
}

if (darkQuery) {
  const sync = () => {
    if (themePreference.value === 'system') theme.value = resolve('system');
  };
  if (typeof darkQuery.addEventListener === 'function') darkQuery.addEventListener('change', sync);
  else darkQuery.addListener?.(sync);
}
