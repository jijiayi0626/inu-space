<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AppIcon from './AppIcon.vue';
import { session } from '../lib/session';

defineEmits(['close']);

const route = useRoute();
const user = computed(() => session.user || {});

const groups = [
  {
    label: '账号中心',
    links: [
      { to: '/', icon: 'grid', label: '总览', key: 'overview' },
      { to: '/profile', icon: 'user', label: '个人资料', key: 'profile' },
      { to: '/security', icon: 'shield', label: '账户安全', key: 'security' },
      { to: '/devices', icon: 'device', label: '星际终端', key: 'devices' },
      { to: '/notifications', icon: 'bell', label: '通知偏好', key: 'notifications' },
    ],
  },
  {
    label: '星际业务',
    links: [
      { to: '/supply', icon: 'box', label: '星际补给站', key: 'supply' },
      { to: '/agreements', icon: 'file', label: '协议中心', key: 'agreements' },
    ],
  },
];

function isActive(key) {
  return route.meta.side === key;
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
          :class="{ active: isActive(link.key) }"
          :aria-current="isActive(link.key) ? 'page' : undefined"
          @click="$emit('close')"
        >
          <AppIcon :name="link.icon" />
          <span>{{ link.label }}</span>
          <span class="side-orbit"><AppIcon name="orbit" /></span>
        </RouterLink>
      </nav>
    </template>

    <div v-if="!user.verified" class="side-promo">
      <div class="promo-head"><AppIcon name="spark" /><span>解锁跃迁权限</span></div>
      <p>完成星际公民认证，开启补给站与星能提现能力。</p>
      <RouterLink class="btn btn-primary btn-sm promo-btn" to="/profile#verify" @click="$emit('close')">
        立即认证
      </RouterLink>
    </div>
    <div v-else class="side-promo side-promo-done">
      <div class="promo-head"><AppIcon name="shield" /><span>星际公民 · 已认证</span></div>
      <p>你的星际档案已完成核验，补给站与星能权限已解锁。</p>
      <RouterLink class="btn btn-ghost btn-sm promo-btn" to="/supply" @click="$emit('close')">
        前往补给站
      </RouterLink>
    </div>
  </aside>
</template>
