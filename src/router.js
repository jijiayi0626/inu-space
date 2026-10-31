import { createRouter, createWebHistory } from 'vue-router';
import { ensureSession } from './lib/session';
import { toast } from './lib/toast';

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('./views/LoginView.vue'),
    meta: { public: true, title: '进入星际通行证' },
  },
  {
    path: '/',
    name: 'overview',
    component: () => import('./views/OverviewView.vue'),
    meta: { title: '账号总览', top: 'home', side: 'overview' },
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('./views/ProfileView.vue'),
    meta: { title: '个人资料', top: 'account', side: 'profile' },
  },
  {
    path: '/security',
    name: 'security',
    component: () => import('./views/SecurityView.vue'),
    meta: { title: '账户安全', top: 'account', side: 'security' },
  },
  {
    path: '/devices',
    name: 'devices',
    component: () => import('./views/DevicesView.vue'),
    meta: { title: '星际终端', top: 'account', side: 'devices' },
  },
  {
    path: '/notifications',
    name: 'notifications',
    component: () => import('./views/NotificationsView.vue'),
    meta: { title: '通知偏好', top: 'account', side: 'notifications' },
  },
  {
    path: '/member',
    name: 'member',
    component: () => import('./views/MemberView.vue'),
    meta: { title: '会员中心', top: 'member', side: 'member' },
  },
  {
    path: '/agreements',
    name: 'agreements',
    component: () => import('./views/AgreementsView.vue'),
    meta: { title: '协议中心', top: 'agreements', side: 'agreements' },
  },
  {
    path: '/supply',
    name: 'supply',
    component: () => import('./views/SupplyView.vue'),
    meta: { title: '星际补给站', top: '', side: 'supply' },
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition;
    if (to.hash) return { el: to.hash, top: 84, behavior: 'smooth' };
    return { top: 0 };
  },
});

router.beforeEach(async (to) => {
  if (to.meta.public) {
    if (to.name === 'login') {
      try {
        const signedIn = await ensureSession();
        if (signedIn) return { name: 'overview' };
      } catch {
        /* 登录页允许在断网时继续展示 */
      }
    }
    return true;
  }

  try {
    const signedIn = await ensureSession();
    if (!signedIn) {
      return { name: 'login', query: { redirect: to.fullPath } };
    }
  } catch (error) {
    toast(error.message || '无法连接星际网络', 'error');
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  return true;
});

router.afterEach((to) => {
  const title = to.meta.title ? `${to.meta.title} · INU 星际通行证` : 'INU 星际通行证';
  document.title = title;
});

export default router;
