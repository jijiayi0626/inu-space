<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import TopBar from './TopBar.vue';
import SideBar from './SideBar.vue';
import { toast } from '../lib/toast';

const route = useRoute();
const drawerOpen = ref(false);

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
        <slot />

        <footer class="page-footer">
          <span>© 2026 INU 无限宇宙 · 星际通行证</span>
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
