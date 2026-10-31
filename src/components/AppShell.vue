<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import TopBar from './TopBar.vue';
import SideBar from './SideBar.vue';
import AppIcon from './AppIcon.vue';
import { session } from '../lib/session';
import { toast } from '../lib/toast';

const route = useRoute();
const drawerOpen = ref(false);

const notice = computed(() => {
  const value = session.site?.notice;
  return value?.enabled && value?.text ? value : null;
});
const noticeIcon = computed(() => {
  if (notice.value?.level === 'success') return 'check';
  if (notice.value?.level === 'warn') return 'shield';
  return 'spark';
});
const footerText = computed(() => session.site?.footerText || '© 2026 INU 无限宇宙 · 星际通行证');

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
            <button type="button" class="footer-link-btn" @click="toast('帮助终端正在接入星际网络')">帮助终端</button>
          </span>
        </footer>
      </div>
    </main>

    <div class="drawer-mask" :class="{ show: drawerOpen }" @click="closeDrawer" />
  </div>
</template>

<style scoped>
.readonly-banner{
  display:flex;align-items:flex-start;gap:11px;padding:12px 15px;margin-bottom:16px;
  border-radius:12px;border:1px solid rgba(255,125,0,.22);background:rgba(255,125,0,.08);
}
.readonly-banner-icon{
  width:30px;height:30px;border-radius:9px;display:grid;place-items:center;flex:none;
  color:var(--warning);background:rgba(255,125,0,.14);
}
.readonly-banner-icon .icon{width:16px;height:16px}
.readonly-banner div{display:flex;flex-direction:column;gap:2px;min-width:0}
.readonly-banner strong{font-size:12.5px;font-weight:700;color:var(--text)}
.readonly-banner span{font-size:12px;line-height:1.6;color:var(--text-sub)}

.site-notice{
  display:flex;align-items:flex-start;gap:9px;padding:11px 14px;margin-bottom:16px;
  border-radius:11px;font-size:12.5px;line-height:1.65;
  color:var(--primary);background:var(--primary-light);border:1px solid rgba(22,93,255,.14);
}
.site-notice .icon{width:16px;height:16px;margin-top:2px;flex:none}
.site-notice.is-success{color:var(--success);background:rgba(0,180,42,.08);border-color:rgba(0,180,42,.16)}
.site-notice.is-warn{color:var(--warning);background:rgba(255,125,0,.08);border-color:rgba(255,125,0,.18)}
</style>
