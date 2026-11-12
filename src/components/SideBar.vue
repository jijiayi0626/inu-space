<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AppIcon from './AppIcon.vue';
import { adminSections } from '../lib/adminSections';
import { session } from '../lib/session';

defineEmits(['close']);

const route = useRoute();
const user = computed(() => session.user || {});
const verificationAvailable = computed(
  () => session.site?.features?.verification !== false && session.site?.verification?.mode !== 'off',
);

const baseGroups = [
  {
    label: '账号中心',
    links: [
      { to: '/', icon: 'grid', label: '总览', key: 'overview' },
      { to: '/profile', icon: 'user', label: '个人资料', key: 'profile' },
      { to: '/security', icon: 'shield', label: '账户安全', key: 'security' },
      { to: '/connections', icon: 'globe', label: '授权应用', key: 'connections' },
      { to: '/devices', icon: 'device', label: '登录设备', key: 'devices' },
      { to: '/notifications', icon: 'bell', label: '通知偏好', key: 'notifications' },
    ],
  },
  {
    label: '服务',
    links: [
      { to: '/supply', icon: 'box', label: '积分商城', key: 'supply' },
      { to: '/agreements', icon: 'file', label: '协议中心', key: 'agreements' },
    ],
  },
];

const groups = computed(() => {
  const list = baseGroups.map((group) => ({ ...group, links: [...group.links] }));
  if (!user.value.isAdmin) return list;
  if (route.path.startsWith('/admin')) {
    list.push({
      label: '超级管理台',
      links: adminSections.map((section) => ({
        to: `/admin/${section.key}`,
        icon: section.icon,
        label: section.label,
        key: `admin-${section.key}`,
        match: true,
      })),
    });
  } else {
    list.push({
      label: '超级管理台',
      links: [{ to: '/admin', icon: 'key', label: '管理后台', key: 'admin' }],
    });
  }
  return list;
});

function isActive(link) {
  if (link.match) return route.path === link.to;
  return route.meta.side === link.key;
}
</script>

<template>
  <aside class="sidebar" aria-label="侧边导航">
    <template v-for="group in groups" :key="group.label">
      <p class="side-group">{{ group.label }}</p>
      <nav class="side-nav">
        <RouterLink
          v-for="link in group.links"
          :key="link.key"
          :to="link.to"
          class="side-link"
          :class="{ active: isActive(link) }"
          :aria-current="isActive(link) ? 'page' : undefined"
          @click="$emit('close')"
        >
          <AppIcon :name="link.icon" />
          <span>{{ link.label }}</span>
        </RouterLink>
      </nav>
    </template>

    <div v-if="!user.verified && verificationAvailable" class="side-promo">
      <div class="promo-head"><AppIcon name="idcard" /><span>解锁完整权限</span></div>
      <p>完成实名认证，开启积分商城与余额提现能力。</p>
      <RouterLink class="btn btn-primary btn-sm promo-btn" to="/profile#verify" @click="$emit('close')">
        立即认证
      </RouterLink>
    </div>
    <div v-else-if="user.verified" class="side-promo side-promo-done">
      <div class="promo-head"><AppIcon name="shield" /><span>已实名认证</span></div>
      <p>你的个人资料已完成核验，积分商城与余额权限已解锁。</p>
      <RouterLink class="btn btn-ghost btn-sm promo-btn" to="/supply" @click="$emit('close')">
        前往积分商城
      </RouterLink>
    </div>
  </aside>
</template>
