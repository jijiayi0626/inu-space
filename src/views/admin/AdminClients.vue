<script setup>
import { computed, reactive, ref } from 'vue';
import AppIcon from '../../components/AppIcon.vue';
import BaseModal from '../../components/BaseModal.vue';
import { api } from '../../lib/api';
import { copyText } from '../../lib/adminHelpers';
import { timeLabel } from '../../lib/format';
import { toast } from '../../lib/toast';

const props = defineProps({
  data: { type: Object, default: null },
  reload: { type: Function, required: true },
  askConfirm: { type: Function, required: true },
});

const clients = computed(() => props.data?.clients || []);
const scopes = computed(() => props.data?.scopes || []);

function scopeLabel(key) {
  return scopes.value.find((item) => item.key === key)?.label || key;
}

const clientModal = ref(false);
const editingClient = ref(null);
const savingClient = ref(false);
const clientError = ref('');
const clientForm = reactive({
  name: '',
  description: '',
  homepageUrl: '',
  redirectUris: '',
  scopes: ['profile', 'email'],
  isPublic: false,
});

function resetClientForm() {
  clientForm.name = '';
  clientForm.description = '';
  clientForm.homepageUrl = '';
  clientForm.redirectUris = '';
  clientForm.scopes = ['profile', 'email'];
  clientForm.isPublic = false;
  clientError.value = '';
}

function openCreateClient() {
  editingClient.value = null;
  resetClientForm();
  clientModal.value = true;
}

function openEditClient(client) {
  editingClient.value = client;
  clientForm.name = client.name;
  clientForm.description = client.description || '';
  clientForm.homepageUrl = client.homepageUrl || '';
  clientForm.redirectUris = client.redirectUris.join('\n');
  clientForm.scopes = [...client.scopes];
  clientForm.isPublic = client.isPublic;
  clientError.value = '';
  clientModal.value = true;
}

function toggleScope(key) {
  if (clientForm.scopes.includes(key)) {
    clientForm.scopes = clientForm.scopes.filter((item) => item !== key);
  } else {
    clientForm.scopes = [...clientForm.scopes, key];
  }
}

const secretModal = ref(false);
const secretValue = ref('');
const secretClientName = ref('');

function revealSecret(name, secret) {
  secretClientName.value = name;
  secretValue.value = secret;
  secretModal.value = true;
}

async function submitClient() {
  clientError.value = '';
  const name = clientForm.name.trim();
  const redirectUris = clientForm.redirectUris
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  if ([...name].length < 2 || [...name].length > 40) {
    clientError.value = '应用名称需为 2–40 个字符';
    return;
  }
  if (!redirectUris.length) {
    clientError.value = '请至少填写一个回调地址';
    return;
  }
  if (!clientForm.scopes.length) {
    clientError.value = '请至少选择一个权限范围';
    return;
  }

  const payload = {
    name,
    description: clientForm.description.trim(),
    homepageUrl: clientForm.homepageUrl.trim(),
    redirectUris,
    scopes: clientForm.scopes,
  };
  if (!editingClient.value) payload.isPublic = clientForm.isPublic;

  savingClient.value = true;
  try {
    if (editingClient.value) {
      await api.patch(`/admin/oauth-clients/${editingClient.value.id}`, payload);
      toast('应用配置已更新');
    } else {
      const result = await api.post('/admin/oauth-clients', payload);
      toast('应用已创建');
      if (result.clientSecret) revealSecret(name, result.clientSecret);
    }
    clientModal.value = false;
    await props.reload({ silent: true });
  } catch (error) {
    clientError.value = error.message;
  } finally {
    savingClient.value = false;
  }
}

async function toggleClient(client, event) {
  const enabled = event.target.checked;
  try {
    await api.patch(`/admin/oauth-clients/${client.id}`, { enabled });
    toast(`${client.name} 已${enabled ? '启用' : '停用'}`);
    await props.reload({ silent: true });
  } catch (error) {
    event.target.checked = client.enabled;
    toast(error.message, 'error');
  }
}

function rotateSecret(client) {
  props.askConfirm({
    title: '重置 Client Secret',
    message: `重置后，${client.name} 的旧密钥会立即失效，需要把新密钥更新到应用配置中。`,
    confirmText: '重置密钥',
    action: async () => {
      const result = await api.post(`/admin/oauth-clients/${client.id}/rotate-secret`);
      revealSecret(client.name, result.clientSecret);
      toast('Client Secret 已重置');
      await props.reload({ silent: true });
    },
  });
}

function deleteClient(client) {
  props.askConfirm({
    title: '删除 OAuth 应用',
    message: `删除 ${client.name} 后，该应用签发的全部令牌与用户授权都会失效，且无法恢复。`,
    confirmText: '删除应用',
    danger: true,
    action: async () => {
      await api.del(`/admin/oauth-clients/${client.id}`);
      toast('应用已删除');
      await props.reload({ silent: true });
    },
  });
}
</script>

<template>
  <section class="admin-section">
    <div class="admin-section-head">
      <div>
        <h2>OAuth 应用</h2>
        <p>第三方应用通过这些 client 让用户使用 INU 账号登录。</p>
      </div>
      <button class="btn btn-primary" type="button" @click="openCreateClient">
        <AppIcon name="plus" />
        <span>创建应用</span>
      </button>
    </div>

    <div v-if="!clients.length" class="card admin-empty">
      <span class="admin-empty-icon"><AppIcon name="plug" /></span>
      <h3>还没有接入应用</h3>
      <p>创建一个 OAuth client，把 Client ID 和回调地址交给第三方应用即可开始接入。</p>
      <button class="btn btn-primary btn-sm" type="button" @click="openCreateClient">创建第一个应用</button>
    </div>

    <div v-else class="client-list">
      <article v-for="client in clients" :key="client.id" class="card client-card">
        <div class="client-head">
          <span class="client-mark">{{ (client.name || 'A').slice(0, 1) }}</span>
          <div class="client-title">
            <strong>{{ client.name }}</strong>
            <span v-if="client.description">{{ client.description }}</span>
            <span v-else class="muted">暂无应用描述</span>
          </div>
          <div class="client-badges">
            <span class="badge" :class="client.isPublic ? 'badge-orange' : 'badge-purple'">
              {{ client.isPublic ? '公开客户端' : '机密客户端' }}
            </span>
            <span class="badge" :class="client.enabled ? 'badge-green' : 'badge-gray'">
              {{ client.enabled ? '启用中' : '已停用' }}
            </span>
          </div>
          <label class="switch" :aria-label="`启用 ${client.name}`">
            <input type="checkbox" :checked="client.enabled" @change="toggleClient(client, $event)" />
            <span class="track" />
            <span class="thumb" />
          </label>
        </div>

        <div class="client-grid">
          <div class="client-cell">
            <span>Client ID</span>
            <div class="copy-line">
              <code>{{ client.clientId }}</code>
              <button class="icon-btn copy-btn" type="button" aria-label="复制 Client ID" @click="copyText(client.clientId, 'Client ID 已复制')">
                <AppIcon name="copy" />
              </button>
            </div>
          </div>
          <div class="client-cell">
            <span>权限范围</span>
            <p>{{ client.scopes.map(scopeLabel).join(' · ') }}</p>
          </div>
          <div class="client-cell client-cell-wide">
            <span>回调地址</span>
            <code v-for="uri in client.redirectUris" :key="uri" class="client-uri">{{ uri }}</code>
          </div>
          <div class="client-cell">
            <span>最近使用</span>
            <p>{{ client.lastUsedAt ? timeLabel(client.lastUsedAt) : '尚未使用' }}</p>
          </div>
          <div class="client-cell">
            <span>创建时间</span>
            <p>{{ timeLabel(client.createdAt) }}</p>
          </div>
        </div>

        <div class="client-actions">
          <button class="btn btn-ghost btn-sm" type="button" @click="openEditClient(client)">编辑</button>
          <button v-if="!client.isPublic" class="btn btn-ghost btn-sm" type="button" @click="rotateSecret(client)">重置密钥</button>
          <button class="btn btn-danger btn-sm" type="button" @click="deleteClient(client)">删除</button>
        </div>
      </article>
    </div>
  </section>

  <!-- 创建 / 编辑应用 -->
  <BaseModal v-model="clientModal" :title="editingClient ? '编辑 OAuth 应用' : '创建 OAuth 应用'" width="560px">
    <div class="modal-form">
      <div class="field">
        <label for="client-name">应用名称</label>
        <input id="client-name" v-model="clientForm.name" class="input" maxlength="40" placeholder="例如：示例应用" />
      </div>
      <div class="field">
        <label for="client-desc">应用描述</label>
        <input id="client-desc" v-model="clientForm.description" class="input" maxlength="200" placeholder="一句话介绍这个应用" />
      </div>
      <div class="field">
        <label for="client-home">应用主页</label>
        <input id="client-home" v-model="clientForm.homepageUrl" class="input" placeholder="https://example.com" />
      </div>
      <div class="field">
        <label for="client-redirects">回调地址</label>
        <textarea id="client-redirects" v-model="clientForm.redirectUris" class="input modal-textarea" rows="4" placeholder="每行一个，例如：&#10;https://example.com/auth/inu/callback" />
        <p class="hint">必须与应用发起授权时使用的 redirect_uri 完全一致；仅支持 https，localhost 可使用 http。</p>
      </div>
      <div class="field">
        <label>权限范围</label>
        <div class="scope-picker">
          <button
            v-for="scope in scopes"
            :key="scope.key"
            type="button"
            class="scope-option"
            :class="{ active: clientForm.scopes.includes(scope.key) }"
            @click="toggleScope(scope.key)"
          >
            <AppIcon :name="clientForm.scopes.includes(scope.key) ? 'check' : 'plus'" />
            <span><strong>{{ scope.label }}</strong><em>{{ scope.key }}</em></span>
          </button>
        </div>
      </div>
      <label v-if="!editingClient" class="public-toggle">
        <span class="switch">
          <input v-model="clientForm.isPublic" type="checkbox" />
          <span class="track" />
          <span class="thumb" />
        </span>
        <span><strong>公开客户端</strong><em>无 Client Secret，强制使用 PKCE（S256），适合 SPA / 移动应用</em></span>
      </label>
      <p v-else class="hint">应用类型：{{ editingClient.isPublic ? '公开客户端（PKCE）' : '机密客户端（Client Secret）' }}，创建后不可修改。</p>
      <p v-if="clientError" class="modal-error">{{ clientError }}</p>
    </div>
    <template #footer>
      <button class="btn btn-ghost" type="button" @click="clientModal = false">取消</button>
      <button class="btn btn-primary" type="button" :disabled="savingClient" @click="submitClient">
        <span v-if="savingClient" class="spinner" />
        <span>{{ savingClient ? '保存中…' : editingClient ? '保存修改' : '创建应用' }}</span>
      </button>
    </template>
  </BaseModal>

  <!-- Client Secret 仅显示一次 -->
  <BaseModal v-model="secretModal" title="Client Secret" width="500px">
    <div class="secret-alert">
      <AppIcon name="lock" />
      <p>请立即把密钥保存到 {{ secretClientName }} 的配置中。关闭后无法再次查看，只能重新生成。</p>
    </div>
    <div class="secret-box">
      <code>{{ secretValue }}</code>
      <button class="icon-btn copy-btn" type="button" aria-label="复制 Client Secret" @click="copyText(secretValue, 'Client Secret 已复制')">
        <AppIcon name="copy" />
      </button>
    </div>
    <template #footer>
      <button class="btn btn-primary" type="button" @click="secretModal = false">我已安全保存</button>
    </template>
  </BaseModal>
</template>
