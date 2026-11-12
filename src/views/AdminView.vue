<script setup>
import { computed, defineAsyncComponent, reactive } from 'vue';
import { Button } from 'fuxsto-design-pro';
import { useRoute, useRouter } from 'vue-router';
import AppIcon from '../components/AppIcon.vue';
import BaseModal from '../components/BaseModal.vue';
import PageHeader from '../components/PageHeader.vue';
import SkeletonBlock from '../components/SkeletonBlock.vue';
import { adminSections } from '../lib/adminSections';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { useAsyncData } from '../lib/useAsyncData';
import '../assets/admin.css';

const { data, reload } = useAsyncData(({ force }) => api.get('/admin', { force, ttl: 0 }));

const route = useRoute();
const router = useRouter();
const tabs = adminSections;
const tab = computed(() => {
  const key = String(route.params.section || '');
  return tabs.some((item) => item.key === key) ? key : 'providers';
});

const sectionComponents = {
  providers: defineAsyncComponent(() => import('./admin/AdminProviders.vue')),
  settings: defineAsyncComponent(() => import('./admin/AdminSettings.vue')),
  content: defineAsyncComponent(() => import('./admin/AdminContent.vue')),
  finance: defineAsyncComponent(() => import('./admin/AdminFinance.vue')),
  users: defineAsyncComponent(() => import('./admin/AdminUsers.vue')),
  clients: defineAsyncComponent(() => import('./admin/AdminClients.vue')),
  access: defineAsyncComponent(() => import('./admin/AdminAccess.vue')),
  audit: defineAsyncComponent(() => import('./admin/AdminAudit.vue')),
  admins: defineAsyncComponent(() => import('./admin/AdminAdmins.vue')),
};

const activeSection = computed(() => sectionComponents[tab.value] || sectionComponents.providers);
const stats = computed(() => data.value?.stats || {});

function switchTab(key) {
  if (key !== tab.value) router.push(`/admin/${key}`);
}

/* ---------- 通用确认 ---------- */

const confirmState = reactive({
  open: false,
  title: '',
  message: '',
  confirmText: '确认',
  danger: false,
  loading: false,
  action: null,
});

function askConfirm({ title, message, confirmText = '确认', danger = false, action }) {
  confirmState.title = title;
  confirmState.message = message;
  confirmState.confirmText = confirmText;
  confirmState.danger = danger;
  confirmState.action = action;
  confirmState.open = true;
}

async function runConfirm() {
  if (!confirmState.action) return;
  confirmState.loading = true;
  try {
    await confirmState.action();
    confirmState.open = false;
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    confirmState.loading = false;
  }
}
</script>

<template>
  <PageHeader title="超级管理台" sub="配置第三方登录、站点设置、OAuth 应用与审计记录。">
    <template #meta>
      <span class="badge badge-blue">超级管理员</span>
      <span class="head-date">仅超级管理员可见</span>
    </template>
  </PageHeader>

  <section v-if="!data" class="card">
    <SkeletonBlock :rows="10" row-height="18px" />
  </section>

  <template v-else>
    <section class="admin-banner">
      <div class="admin-banner-copy">
        <span class="admin-kicker">INU 管理中心</span>
        <h2>账号、接入与运营配置。</h2>
        <p>让第三方应用通过 INU 账号登录，同时统一管理登录入口、站点呈现与访问权限。</p>
      </div>
    </section>

    <div class="admin-stats">
      <div class="admin-stat">
        <span class="admin-stat-icon is-blue"><AppIcon name="user" /></span>
        <div><strong>{{ stats.users }}</strong><span>注册用户</span></div>
        <em>{{ stats.verifiedUsers }} 已认证</em>
      </div>
      <div class="admin-stat">
        <span class="admin-stat-icon is-purple"><AppIcon name="plug" /></span>
        <div><strong>{{ stats.clients }}</strong><span>接入应用</span></div>
        <em>{{ stats.enabledClients }} 个启用中</em>
      </div>
      <div class="admin-stat">
        <span class="admin-stat-icon is-cyan"><AppIcon name="key" /></span>
        <div><strong>{{ stats.activeTokens }}</strong><span>有效令牌</span></div>
        <em>近 7 天签发 {{ stats.issued7d }}</em>
      </div>
      <div class="admin-stat">
        <span class="admin-stat-icon is-green"><AppIcon name="shield" /></span>
        <div><strong>{{ stats.consents }}</strong><span>用户授权</span></div>
        <em>覆盖 {{ stats.clients }} 个应用</em>
      </div>
    </div>

    <div class="admin-tabs" role="tablist" aria-label="管理台分区">
      <button
        v-for="item in tabs"
        :key="item.key"
        type="button"
        role="tab"
        class="admin-tab"
        :class="{ active: tab === item.key }"
        :aria-selected="tab === item.key"
        @click="switchTab(item.key)"
      >
        <AppIcon :name="item.icon" />
        <span>{{ item.label }}</span>
      </button>
    </div>

    <component :is="activeSection" :data="data" :reload="reload" :ask-confirm="askConfirm" />
  </template>

  <!-- 通用确认 -->
  <BaseModal v-model="confirmState.open" :title="confirmState.title" width="440px">
    <p class="confirm-copy">{{ confirmState.message }}</p>
    <template #footer>
      <Button variant="secondary" type="button" @click="confirmState.open = false">取消</Button>
      <Button
        :variant="confirmState.danger ? 'destructive' : 'primary'"
        type="button"
        :loading="confirmState.loading"
        loading-text="处理中…"
        @click="runConfirm"
      >
        {{ confirmState.confirmText }}
      </Button>
    </template>
  </BaseModal>
</template>
