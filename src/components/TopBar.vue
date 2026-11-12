<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppIcon from './AppIcon.vue';
import { session, logout } from '../lib/session';
import { theme, toggleTheme } from '../lib/theme';
import { toast } from '../lib/toast';

defineEmits(['toggle-drawer']);

const route = useRoute();
const router = useRouter();
const menuOpen = ref(false);

const user = computed(() => session.user || { name: '用户', avatarText: 'U' });
const initial = computed(() => user.value.avatarText || user.value.name?.slice(0, 1) || 'U');
const activeTop = computed(() => route.meta.top || '');

const navItems = [
  { key: 'home', label: '首页', to: '/' },
  { key: 'account', label: '账号中心', to: '/profile' },
  { key: 'member', label: '会员中心', to: '/member' },
  { key: 'agreements', label: '协议中心', to: '/agreements' },
];


async function handleLogout() {
  menuOpen.value = false;
  try {
    await logout();
    toast('已退出登录');
    router.replace('/login');
  } catch {
    toast('退出失败，请稍后重试', 'error');
  }
}

function onDocumentClick() {
  menuOpen.value = false;
}

function onKeydown(event) {
  if (event.key === 'Escape') menuOpen.value = false;
}

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false;
  },
);

onMounted(() => {
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <header class="topbar">
    <div class="topbar-left">
      <button class="icon-btn menu-btn" aria-label="打开菜单" @click="$emit('toggle-drawer')">
        <AppIcon name="menu" />
      </button>
      <RouterLink class="brand" to="/" aria-label="INU 账号中心">
        <span class="brand-mark"><AppIcon name="grid" /></span>
        <span class="brand-text">
          <span class="brand-name">INU</span>
          <span class="brand-sys">账号中心</span>
        </span>
      </RouterLink>
    </div>

    <nav class="topnav" aria-label="主导航">
      <RouterLink
        v-for="item in navItems"
        :key="item.key"
        :to="item.to"
        class="topnav-link"
        :class="{ active: activeTop === item.key }"
      >
        {{ item.label }}
      </RouterLink>
    </nav>

    <div class="topbar-right">
      <button class="icon-btn" aria-label="切换明暗主题" @click="toggleTheme">
        <AppIcon :name="theme === 'dark' ? 'sun' : 'moon'" />
      </button>

      <div class="avatar-wrap">
        <button class="avatar" aria-label="账号菜单" :aria-expanded="menuOpen" @click.stop="menuOpen = !menuOpen">
          {{ initial }}
        </button>
        <Transition name="menu">
          <div v-if="menuOpen" class="avatar-menu" role="menu" @click.stop>
            <div class="avatar-menu-head">
              <span class="avatar avatar-static">{{ initial }}</span>
              <span class="avatar-menu-copy">
                <strong>{{ user.name }}</strong>
                <em>{{ user.inuId }}</em>
              </span>
            </div>
            <div class="avatar-menu-list">
              <RouterLink class="avatar-menu-item" to="/profile" role="menuitem">
                <AppIcon name="user" /><span>个人资料</span>
              </RouterLink>
              <RouterLink class="avatar-menu-item" to="/security" role="menuitem">
                <AppIcon name="shield" /><span>账户安全</span>
              </RouterLink>
              <RouterLink class="avatar-menu-item" to="/devices" role="menuitem">
                <AppIcon name="device" /><span>登录设备</span>
              </RouterLink>
              <RouterLink v-if="user.isAdmin" class="avatar-menu-item admin" to="/admin" role="menuitem">
                <AppIcon name="key" /><span>超级管理台</span>
              </RouterLink>
              <button class="avatar-menu-item danger" type="button" role="menuitem" @click="handleLogout">
                <AppIcon name="logout" /><span>退出登录</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </header>
</template>
