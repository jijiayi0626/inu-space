import { createApp } from 'vue';
import 'fuxsto-design-pro/styles.css';
import './assets/base.css';
import App from './App.vue';
import router from './router';
import { clearSession, session } from './lib/session';
import { toast } from './lib/toast';

let handlingUnauthorized = false;

window.addEventListener('inu:unauthorized', () => {
  if (!session.user || handlingUnauthorized) return;
  handlingUnauthorized = true;
  const current = router.currentRoute.value;
  clearSession();
  toast('登录状态已失效，请重新登录', 'error');
  const target = current.name === 'login' ? { name: 'login' } : { name: 'login', query: { redirect: current.fullPath } };
  router.replace(target).finally(() => {
    handlingUnauthorized = false;
  });
});

const app = createApp(App).use(router);

router.isReady().then(() => {
  app.mount('#app');
});
