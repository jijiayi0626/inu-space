<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import TopBar from './TopBar.vue';
import SideBar from './SideBar.vue';
import AppIcon from './AppIcon.vue';
import { session } from '../lib/session';

const route = useRoute();
const drawerOpen = ref(false);

const notice = computed(() => {
  const value = session.site?.notice;
  return value?.enabled && value?.text ? value : null;
});
const noticeIcon = computed(() => {
  if (notice.value?.level === 'success') return 'check';
  if (notice.value?.level === 'warn') return 'shield';
  return 'info';
});
const footerText = computed(() => session.site?.footerText || '© 2026 INU 账号中心');
const supportEmail = computed(() => session.site?.supportEmail || 'support@inu.space');
const maintenance = computed(() => {
  const value = session.site?.maintenance;
  return value?.enabled && value?.text ? value : null;
});

function closeDrawer() {
  drawerOpen.value = false;
}

watch(drawerOpen, (open) => {
  document.body.classList.toggle('drawer-open', open);
});

watch(
  () => route.fullPath,
  () => closeDrawer(),
);

onBeforeUnmount(() => {
  document.body.classList.remove('drawer-open');
});
</script>

<template>
  <TopBar @toggle-drawer="drawerOpen = !drawerOpen" />

  <div class="shell">
    <SideBar @close="closeDrawer" />

    <main class="main">
      <div class="view">
        <div v-if="session.user?.readOnly" class="readonly-banner">
          <span class="readonly-banner-icon"><AppIcon name="lock" /></span>
          <div>
            <strong>演示账号 · 只读模式</strong>
            <span>可以自由浏览和体验，但所有保存、下单与修改操作都会被拒绝。</span>
          </div>
        </div>

        <div v-if="maintenance && !session.user?.isAdmin" class="site-notice is-warn">
          <AppIcon name="shield" />
          <span>维护模式：{{ maintenance.text }}</span>
        </div>

        <div v-if="notice" class="site-notice" :class="`is-${notice.level}`">
          <AppIcon :name="noticeIcon" />
          <span>{{ notice.text }}</span>
        </div>

        <slot />

        <footer class="page-footer">
          <span>{{ footerText }}</span>
          <span class="footer-links">
            <RouterLink to="/agreements">服务协议</RouterLink>
            <span>·</span>
            <RouterLink to="/agreements">隐私政策</RouterLink>
            <span>·</span>
            <a class="footer-link-btn" :href="`mailto:${supportEmail}`">帮助中心</a>
          </span>
        </footer>
      </div>
    </main>

    <div class="drawer-mask" :class="{ show: drawerOpen }" @click="closeDrawer" />
  </div>
</template>

<style scoped>
.readonly-banner{
  display:flex;align-items:flex-start;gap:var(--s-3);padding:var(--s-3);margin-bottom:var(--s-4);
  border-radius:var(--r-sm);background:color-mix(in srgb, var(--fx-warning) 10%, transparent);
}
.readonly-banner-icon{
  width:30px;height:30px;border-radius:var(--r-xs);display:grid;place-items:center;flex:none;
  color:var(--fx-warning);background:color-mix(in srgb, var(--fx-warning) 14%, transparent);
}
.readonly-banner-icon .icon{width:16px;height:16px}
.readonly-banner div{display:flex;flex-direction:column;gap:2px;min-width:0}
.readonly-banner strong{font-size:var(--fx-text-sm);font-weight:var(--fx-weight-medium);color:var(--fx-foreground)}
.readonly-banner span{font-size:var(--fx-text-xs);line-height:1.6;color:var(--fx-muted-foreground)}

.site-notice{
  display:flex;align-items:flex-start;gap:var(--s-2);padding:var(--s-2) var(--s-3);margin-bottom:var(--s-4);
  border-radius:var(--r-sm);font-size:var(--fx-text-xs);line-height:1.65;
  color:var(--fx-foreground);background:var(--fx-muted);
}
.site-notice .icon{width:16px;height:16px;margin-top:2px;flex:none;color:var(--fx-muted-foreground)}
.site-notice.is-success{color:var(--fx-success);background:color-mix(in srgb, var(--fx-success) 10%, transparent)}
.site-notice.is-warn{color:var(--fx-warning);background:color-mix(in srgb, var(--fx-warning) 10%, transparent)}
</style>
