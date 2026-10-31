import { onMounted, ref } from 'vue';
import { toast } from './toast';

export function useAsyncData(loader, { immediate = true } = {}) {
  const data = ref(null);
  const loading = ref(false);
  const error = ref('');

  async function load({ force = false, silent = false } = {}) {
    if (!silent) loading.value = data.value === null;
    error.value = '';
    try {
      const result = await loader({ force });
      data.value = result;
      return result;
    } catch (err) {
      error.value = err.message || '加载失败';
      if (!silent) toast(error.value, 'error');
      return null;
    } finally {
      loading.value = false;
    }
  }

  if (immediate) onMounted(() => load());

  return {
    data,
    loading,
    error,
    load,
    reload: (options = {}) => load({ ...options, force: true }),
  };
}
