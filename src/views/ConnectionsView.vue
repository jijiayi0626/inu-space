<script setup>
import { computed, ref } from 'vue';
import AppIcon from '../components/AppIcon.vue';
import BaseModal from '../components/BaseModal.vue';
import PageHeader from '../components/PageHeader.vue';
import SkeletonBlock from '../components/SkeletonBlock.vue';
import { api } from '../lib/api';
import { timeLabel } from '../lib/format';
import { toast } from '../lib/toast';
import { useAsyncData } from '../lib/useAsyncData';

const { data, reload } = useAsyncData(({ force }) => api.get('/security/connections', { force }));

const connections = computed(() => data.value?.connections || []);
const revokeOpen = ref(false);
const revokeTarget = ref(null);
const revokeLoading = ref(false);

function scopeLabel(item) {
  return item.scopes.map((scope) => scope.label).join(' · ') || '基础资料';
}

function safeHomepage(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function askRevoke(item) {
  revokeTarget.value = item;
  revokeOpen.value = true;
}

async function revokeConnection() {
  if (!revokeTarget.value) return;
  revokeLoading.value = true;
  try {
    const result = await api.del(`/security/connections/${encodeURIComponent(revokeTarget.value.clientId)}`);
    toast(result.message || '已撤销应用授权');
    revokeOpen.value = false;
    revokeTarget.value = null;
    await reload({ silent: true });
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    revokeLoading.value = false;
  }
}
</script>

<template>
  <PageHeader title="授权应用" sub="管理通过「使用 INU 账号登录」访问你个人资料的第三方应用。">
    <template #meta>
      <span class="badge" :class="connections.length ? 'badge-blue' : 'badge-gray'">
        {{ connections.length }} 个应用
      </span>
      <span class="head-date">OAuth 2.0 · 可随时撤销</span>
    </template>
  </PageHeader>

  <section v-if="!data" class="card">
    <SkeletonBlock :rows="7" row-height="18px" />
  </section>

  <div v-else class="profile-grid">
    <div class="profile-main">
      <section class="card">
        <div class="card-head">
          <h2>已授权应用</h2>
          <span class="badge" :class="connections.length ? 'badge-blue' : 'badge-gray'">
            {{ connections.length }} 个
          </span>
        </div>
        <p class="card-desc">
          这些应用获得了你的资料访问权限。撤销后，应用持有的令牌会立即失效，需要重新发起授权。
        </p>

        <div v-for="item in connections" :key="item.clientId" class="connection-row">
          <span class="sec-icon"><AppIcon name="globe" /></span>
          <div class="connection-info">
            <p class="sec-title">
              {{ item.name }}
              <span v-if="!item.enabled" class="badge badge-gray">已停用</span>
              <span v-else-if="item.activeTokens" class="badge badge-green">使用中</span>
            </p>
            <p class="connection-desc">{{ item.description || '该应用未填写说明' }}</p>
            <p class="connection-meta">授权范围：{{ scopeLabel(item) }}</p>
            <p class="connection-meta">
              授权于 {{ timeLabel(item.authorizedAt) }} ·
              {{ item.lastUsedAt ? `最近使用 ${timeLabel(item.lastUsedAt)}` : '尚未使用' }} ·
              {{ item.activeTokens }} 个有效令牌
            </p>
            <a
              v-if="safeHomepage(item.homepageUrl)"
              class="connection-link"
              :href="safeHomepage(item.homepageUrl)"
              target="_blank"
              rel="noopener noreferrer"
            >
              访问应用主页 <AppIcon name="chevron" />
            </a>
          </div>
          <div class="connection-actions">
            <button class="btn btn-danger btn-sm" type="button" @click="askRevoke(item)">撤销授权</button>
          </div>
        </div>

        <div v-if="!connections.length" class="inline-empty">
          <span class="inline-empty-icon"><AppIcon name="globe" /></span>
          <h3>还没有授权任何应用</h3>
          <p>当你在第三方应用中选择「使用 INU 账号登录」并确认授权后，记录会出现在这里。</p>
        </div>
      </section>
    </div>

    <aside class="profile-side">
      <section class="card">
        <div class="card-head">
          <h2>授权说明</h2>
          <span class="head-note">接入说明</span>
        </div>
        <div class="tip-item">
          <AppIcon name="shield" />
          <span>应用只能在授权范围内读取资料，不会获得你的登录密码。</span>
        </div>
        <div class="tip-item">
          <AppIcon name="clock" />
          <span>访问令牌有效期 1 小时，过期后应用需重新换取。</span>
        </div>
        <div class="tip-item">
          <AppIcon name="lock" />
          <span>撤销授权会吊销该应用的全部令牌，并删除授权记录。</span>
        </div>
        <div class="tip-item">
          <AppIcon name="eye" />
          <span>如果发现不认识的授权，请立即撤销并修改登录密码。</span>
        </div>
      </section>

      <section class="card">
        <div class="card-head">
          <h2>相关入口</h2>
        </div>
        <div class="tip-item">
          <AppIcon name="shield" />
          <span><RouterLink class="inline-link" to="/security">账户安全</RouterLink>：查看登录记录与安全评分。</span>
        </div>
        <div class="tip-item">
          <AppIcon name="device" />
          <span><RouterLink class="inline-link" to="/devices">登录设备</RouterLink>：管理浏览器与设备会话。</span>
        </div>
      </section>
    </aside>
  </div>

  <BaseModal v-model="revokeOpen" title="撤销应用授权" width="440px">
    <div v-if="revokeTarget" class="revoke-copy">
      <p>撤销后，「{{ revokeTarget.name }}」将立即失去访问令牌，无法继续读取你的 INU 资料。</p>
      <p class="hint">应用如需再次访问，需要重新发起授权并经过你确认。</p>
    </div>
    <template #footer>
      <button class="btn btn-ghost btn-sm" type="button" @click="revokeOpen = false">取消</button>
      <button class="btn btn-danger btn-sm" type="button" :disabled="revokeLoading" @click="revokeConnection">
        <span v-if="revokeLoading" class="spinner" />
        {{ revokeLoading ? '正在撤销…' : '撤销授权' }}
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.connection-row{
  display:flex;align-items:flex-start;gap:var(--s-3);padding:var(--s-4) 0;
  border-bottom:1px solid var(--fx-border);
}
.connection-row:first-of-type{padding-top:0}
.connection-row:last-child{border-bottom:none;padding-bottom:0}
.connection-info{min-width:0;flex:1}
.connection-desc{margin-top:var(--s-1);font-size:var(--fx-text-xs);line-height:1.6;color:var(--text-sub)}
.connection-meta{margin-top:var(--s-1);font-size:var(--fx-text-xs);line-height:1.6;color:var(--text-mute)}
.connection-link{
  display:inline-flex;align-items:center;gap:var(--s-1);margin-top:var(--s-2);
  font-size:var(--fx-text-xs);font-weight:var(--fx-weight-semibold);color:var(--primary);
}
.connection-link .icon{width:13px;height:13px}
.connection-actions{flex:none;padding-top:2px}
.revoke-copy p{margin:0 0 var(--s-2);color:var(--text-sub);line-height:1.7}
.revoke-copy .hint{margin:0;color:var(--text-mute)}
.inline-link{color:var(--primary);font-weight:600}
@media (max-width:720px){
  .connection-row{flex-wrap:wrap}
  .connection-actions{margin-left:48px}
}
</style>
