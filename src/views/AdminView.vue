<script setup>
import { computed, reactive, ref, watch } from 'vue';
import AppIcon from '../components/AppIcon.vue';
import BaseModal from '../components/BaseModal.vue';
import PageHeader from '../components/PageHeader.vue';
import SkeletonBlock from '../components/SkeletonBlock.vue';
import { api } from '../lib/api';
import { dateTimeLabel, timeLabel } from '../lib/format';
import { toast } from '../lib/toast';
import { useAsyncData } from '../lib/useAsyncData';

const { data, reload } = useAsyncData(({ force }) => api.get('/admin', { force, ttl: 0 }));

const tab = ref('providers');
const tabs = [
  { key: 'providers', label: '登录方式', icon: 'shield' },
  { key: 'clients', label: '应用接入', icon: 'plug' },
  { key: 'access', label: '接入指引', icon: 'file' },
  { key: 'audit', label: '审计日志', icon: 'clock' },
  { key: 'admins', label: '管理员', icon: 'key' },
];

const stats = computed(() => data.value?.stats || {});
const providers = computed(() => data.value?.providers || []);
const clients = computed(() => data.value?.clients || []);
const admins = computed(() => data.value?.admins || []);
const audit = computed(() => data.value?.audit || []);
const endpoints = computed(() => data.value?.endpoints || {});
const scopes = computed(() => data.value?.scopes || []);
const configReady = computed(() => Boolean(data.value?.config?.secretKeyReady));

const providerForms = reactive({
  github: { clientId: '', clientSecret: '', enabled: false, saving: false },
  google: { clientId: '', clientSecret: '', enabled: false, saving: false },
});

watch(
  providers,
  (list) => {
    for (const provider of list) {
      const form = providerForms[provider.id];
      if (!form) continue;
      form.clientId = provider.clientId || '';
      form.clientSecret = '';
      form.enabled = provider.enabled;
    }
  },
  { immediate: true },
);

async function copyText(value, label = '已复制') {
  const text = String(value || '');
  if (!text) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
    }
    toast(label);
  } catch {
    toast('复制失败，请手动选择文本', 'error');
  }
}

async function saveProvider(provider) {
  const form = providerForms[provider.id];
  if (!form) return;
  if (form.enabled && !form.clientId.trim()) {
    toast('启用前请填写 Client ID', 'error');
    return;
  }
  form.saving = true;
  try {
    await api.patch(`/admin/providers/${provider.id}`, {
      clientId: form.clientId.trim(),
      clientSecret: form.clientSecret,
      enabled: form.enabled,
      clearSecret: false,
    });
    form.clientSecret = '';
    toast(`${provider.label} 登录配置已保存`);
    await reload({ silent: true });
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    form.saving = false;
  }
}

/* ---------- OAuth 应用 ---------- */

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
    await reload({ silent: true });
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
    await reload({ silent: true });
  } catch (error) {
    event.target.checked = client.enabled;
    toast(error.message, 'error');
  }
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

function rotateSecret(client) {
  askConfirm({
    title: '重置 Client Secret',
    message: `重置后，${client.name} 的旧密钥会立即失效，需要把新密钥更新到应用配置中。`,
    confirmText: '重置密钥',
    action: async () => {
      const result = await api.post(`/admin/oauth-clients/${client.id}/rotate-secret`);
      revealSecret(client.name, result.clientSecret);
      toast('Client Secret 已重置');
      await reload({ silent: true });
    },
  });
}

function deleteClient(client) {
  askConfirm({
    title: '删除 OAuth 应用',
    message: `删除 ${client.name} 后，该应用签发的全部令牌与用户授权都会失效，且无法恢复。`,
    confirmText: '删除应用',
    danger: true,
    action: async () => {
      await api.del(`/admin/oauth-clients/${client.id}`);
      toast('应用已删除');
      await reload({ silent: true });
    },
  });
}

/* ---------- 管理员 ---------- */

const adminEmail = ref('');
const granting = ref(false);

async function grantAdmin() {
  const email = adminEmail.value.trim();
  if (!email) {
    toast('请输入账号邮箱', 'error');
    return;
  }
  granting.value = true;
  try {
    await api.post('/admin/admins', { email });
    adminEmail.value = '';
    toast('已授予超级管理员权限');
    await reload({ silent: true });
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    granting.value = false;
  }
}

function removeAdmin(admin) {
  askConfirm({
    title: '移除管理员',
    message: `确定移除 ${admin.name}（${admin.email}）的超级管理员权限吗？`,
    confirmText: '移除权限',
    danger: true,
    action: async () => {
      await api.del(`/admin/admins/${admin.userId}`);
      toast('管理员权限已移除');
      await reload({ silent: true });
    },
  });
}

function scopeLabel(key) {
  return scopes.value.find((item) => item.key === key)?.label || key;
}

function sourceLabel(source) {
  if (source === 'db') return '管理台配置';
  if (source === 'env') return '环境变量';
  return '未配置';
}
</script>

<template>
  <PageHeader title="超级管理台" sub="配置第三方登录、管理 OAuth 应用与审计记录。">
    <template #meta>
      <span class="badge badge-blue">SUPER ADMIN</span>
      <span class="head-date">仅超级管理员可见</span>
    </template>
  </PageHeader>

  <section v-if="!data" class="card">
    <SkeletonBlock :rows="10" row-height="18px" />
  </section>

  <template v-else>
    <section class="admin-banner">
      <div class="admin-banner-copy">
        <span class="admin-kicker"><span class="pulse-dot" />INU IDENTITY CONTROL</span>
        <h2>一张通行证，连接整个星际生态。</h2>
        <p>让第三方应用通过 INU 账号登录，同时统一管理 GitHub / Google 登录入口。</p>
      </div>
      <div class="admin-orbit" aria-hidden="true">
        <span class="admin-ring ring-one" />
        <span class="admin-ring ring-two" />
        <span class="admin-core">INU</span>
        <span class="admin-dot dot-one" />
        <span class="admin-dot dot-two" />
      </div>
    </section>

    <div class="admin-stats">
      <div class="admin-stat">
        <span class="admin-stat-icon is-blue"><AppIcon name="user" /></span>
        <div><strong>{{ stats.users }}</strong><span>星际公民</span></div>
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
        @click="tab = item.key"
      >
        <AppIcon :name="item.icon" />
        <span>{{ item.label }}</span>
      </button>
    </div>

    <!-- 第三方登录配置 -->
    <section v-if="tab === 'providers'" class="admin-section">
      <div v-if="!configReady" class="admin-alert">
        <AppIcon name="lock" />
        <div>
          <strong>尚未配置 CONFIG_KEY</strong>
          <p>Client Secret 需要加密后写入 D1。请先为 Worker 设置 CONFIG_KEY 环境密钥，再在下方保存新的密钥。</p>
        </div>
      </div>

      <div class="provider-grid">
        <article v-for="provider in providers" :key="provider.id" class="card provider-card">
          <div class="provider-head">
            <span class="provider-mark" :class="`is-${provider.id}`">
              <AppIcon :name="provider.id === 'github' ? 'github' : 'google'" />
            </span>
            <div class="provider-title">
              <strong>{{ provider.label }}</strong>
              <span>
                <span class="badge" :class="provider.enabled ? 'badge-green' : 'badge-gray'">
                  {{ provider.enabled ? '已启用' : '未启用' }}
                </span>
                <span class="badge badge-blue">{{ sourceLabel(provider.source) }}</span>
                <span v-if="provider.backup" class="badge badge-orange">备用</span>
              </span>
            </div>
            <label class="switch" :aria-label="`启用 ${provider.label} 登录`">
              <input v-model="providerForms[provider.id].enabled" type="checkbox" />
              <span class="track" />
              <span class="thumb" />
            </label>
          </div>

          <p v-if="provider.secretError" class="provider-warn">
            已保存的 Client Secret 无法解密，请重新保存密钥或检查 CONFIG_KEY。
          </p>

          <div class="provider-fields">
            <div class="field">
              <label :for="`${provider.id}-client-id`">Client ID</label>
              <input
                :id="`${provider.id}-client-id`"
                v-model="providerForms[provider.id].clientId"
                class="input"
                autocomplete="off"
                placeholder="填写 OAuth App 的 Client ID"
              />
            </div>
            <div class="field">
              <label :for="`${provider.id}-client-secret`">Client Secret</label>
              <input
                :id="`${provider.id}-client-secret`"
                v-model="providerForms[provider.id].clientSecret"
                class="input"
                type="password"
                autocomplete="new-password"
                :placeholder="provider.hasSecret ? '已保存，留空表示不修改' : '填写 Client Secret'"
              />
            </div>
          </div>

          <div class="provider-callback">
            <span class="provider-label">回调地址</span>
            <div class="copy-line">
              <code>{{ provider.callbackUrl }}</code>
              <button class="icon-btn copy-btn" type="button" aria-label="复制回调地址" @click="copyText(provider.callbackUrl, '回调地址已复制')">
                <AppIcon name="copy" />
              </button>
            </div>
          </div>

          <div class="provider-foot">
            <span class="provider-hint">
              {{ provider.id === 'github' ? 'GitHub 只允许填写一个回调地址' : 'Google 支持多个回调地址' }}
            </span>
            <button class="btn btn-primary btn-sm" type="button" :disabled="providerForms[provider.id].saving" @click="saveProvider(provider)">
              <span v-if="providerForms[provider.id].saving" class="spinner" />
              <span>{{ providerForms[provider.id].saving ? '保存中…' : '保存配置' }}</span>
            </button>
          </div>
        </article>
      </div>

      <div class="card provider-note">
        <AppIcon name="spark" />
        <p>
          保存后立即生效，无需重新部署。未填写 Client Secret 时会保留已保存的密钥；
          GitHub / Google 平台上的回调地址必须与上方完全一致。
        </p>
      </div>
    </section>

    <!-- 应用接入 -->
    <section v-if="tab === 'clients'" class="admin-section">
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

    <!-- 接入指引 -->
    <section v-if="tab === 'access'" class="admin-section">
      <div class="card">
        <div class="card-head">
          <h2>OAuth 2.0 接入端点</h2>
          <span class="badge badge-blue">Authorization Code</span>
        </div>
        <div class="endpoint-list">
          <div v-for="item in [
            { key: 'authorization', label: '授权地址', hint: '引导用户打开，完成登录与授权' },
            { key: 'token', label: 'Token 地址', hint: '服务端使用 code 换取 access_token' },
            { key: 'userinfo', label: '用户信息', hint: '携带 Bearer Token 获取用户资料' },
            { key: 'revocation', label: '撤销令牌', hint: '用户退出应用时撤销 access_token' },
            { key: 'discovery', label: '发现文档', hint: 'OAuth 2.0 授权服务器元数据' },
          ]" :key="item.key" class="endpoint-row">
            <div class="endpoint-copy">
              <strong>{{ item.label }}</strong>
              <span>{{ item.hint }}</span>
            </div>
            <div class="copy-line endpoint-value">
              <code>{{ endpoints[item.key] }}</code>
              <button class="icon-btn copy-btn" type="button" :aria-label="`复制${item.label}`" @click="copyText(endpoints[item.key], `${item.label}已复制`)">
                <AppIcon name="copy" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="access-grid">
        <div class="card">
          <h2 class="access-title">接入步骤</h2>
          <ol class="access-steps">
            <li><span>01</span><div><strong>创建应用</strong><p>登记应用名称与回调地址，获得 Client ID 与 Client Secret。</p></div></li>
            <li><span>02</span><div><strong>引导授权</strong><p>把用户跳转到授权地址，state 必须随机生成并在回调时校验。</p></div></li>
            <li><span>03</span><div><strong>换取令牌</strong><p>回调拿到 code 后，在服务端调用 Token 地址换取 access_token。</p></div></li>
            <li><span>04</span><div><strong>读取资料</strong><p>使用 Bearer Token 调用用户信息接口，完成登录或账号绑定。</p></div></li>
          </ol>
        </div>

        <div class="card">
          <h2 class="access-title">权限范围</h2>
          <div class="scope-list">
            <div v-for="scope in scopes" :key="scope.key" class="scope-row">
              <span class="scope-key">{{ scope.key }}</span>
              <div><strong>{{ scope.label }}</strong><p>{{ scope.description }}</p></div>
            </div>
          </div>
          <div class="access-note">
            <AppIcon name="shield" />
            <p>机密客户端使用 client_secret 认证；公开客户端必须使用 PKCE（S256），且不保存密钥。</p>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h2>最小接入示例</h2>
          <span class="head-note">服务端伪代码</span>
        </div>
        <pre class="access-code"><code>// 1. 引导用户授权
const url = new URL(endpoints.authorization);
url.searchParams.set('response_type', 'code');
url.searchParams.set('client_id', CLIENT_ID);
url.searchParams.set('redirect_uri', CALLBACK_URL);
url.searchParams.set('scope', 'profile email');
url.searchParams.set('state', randomState);

// 2. 回调后换取令牌
const res = await fetch(endpoints.token, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    redirect_uri: CALLBACK_URL,
  }),
});
const { access_token } = await res.json();

// 3. 读取用户资料
const profile = await fetch(endpoints.userinfo, {
  headers: { Authorization: `Bearer ${access_token}` },
}).then((r) =&gt; r.json());</code></pre>
      </div>
    </section>

    <!-- 审计日志 -->
    <section v-if="tab === 'audit'" class="admin-section">
      <div class="card">
        <div class="card-head">
          <h2>管理操作审计</h2>
          <span class="head-note">最近 20 条</span>
        </div>
        <div v-if="!audit.length" class="admin-empty compact">
          <span class="admin-empty-icon"><AppIcon name="clock" /></span>
          <h3>还没有管理操作</h3>
          <p>配置登录方式、创建应用或调整管理员后，记录会出现在这里。</p>
        </div>
        <div v-else class="audit-list">
          <div v-for="log in audit" :key="log.id" class="audit-row">
            <span class="audit-dot" />
            <div class="audit-copy">
              <strong>{{ log.action }}</strong>
              <span>{{ log.detail }}</span>
            </div>
            <div class="audit-meta">
              <span>{{ log.adminName }}</span>
              <em>{{ dateTimeLabel(log.createdAt) }}</em>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 管理员 -->
    <section v-if="tab === 'admins'" class="admin-section">
      <div class="admin-section-head">
        <div>
          <h2>超级管理员</h2>
          <p>拥有管理台全部权限，可以配置登录方式与 OAuth 应用。</p>
        </div>
      </div>

      <div class="card">
        <div class="admin-list">
          <div v-for="admin in admins" :key="admin.userId" class="admin-row">
            <span class="admin-avatar">{{ (admin.name || '管').slice(0, 1) }}</span>
            <div class="admin-copy">
              <strong>{{ admin.name }}<span v-if="admin.email === data?.admins?.[0]?.email" class="badge badge-blue">首位管理员</span></strong>
              <span>{{ admin.email }} · {{ admin.inuId }}</span>
            </div>
            <button class="btn btn-danger btn-sm" type="button" @click="removeAdmin(admin)">移除</button>
          </div>
        </div>

        <div class="admin-grant">
          <div class="field">
            <label for="grant-email">授予其他账号管理员权限</label>
            <input id="grant-email" v-model="adminEmail" class="input" type="email" autocomplete="off" placeholder="输入已注册的 INU 账号邮箱" @keyup.enter="grantAdmin" />
          </div>
          <button class="btn btn-primary" type="button" :disabled="granting" @click="grantAdmin">
            <span v-if="granting" class="spinner" />
            <span>{{ granting ? '授予中…' : '授予权限' }}</span>
          </button>
        </div>
        <p class="hint">也可以通过 Worker 环境变量 ADMIN_EMAILS 指定自动授予管理员的邮箱，多个邮箱用逗号分隔。</p>
      </div>
    </section>
  </template>

  <!-- 创建 / 编辑应用 -->
  <BaseModal v-model="clientModal" :title="editingClient ? '编辑 OAuth 应用' : '创建 OAuth 应用'" width="560px">
    <div class="modal-form">
      <div class="field">
        <label for="client-name">应用名称</label>
        <input id="client-name" v-model="clientForm.name" class="input" maxlength="40" placeholder="例如：星环笔记" />
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

  <!-- 通用确认 -->
  <BaseModal v-model="confirmState.open" :title="confirmState.title" width="440px">
    <p class="confirm-copy">{{ confirmState.message }}</p>
    <template #footer>
      <button class="btn btn-ghost" type="button" @click="confirmState.open = false">取消</button>
      <button class="btn" :class="confirmState.danger ? 'btn-danger' : 'btn-primary'" type="button" :disabled="confirmState.loading" @click="runConfirm">
        <span v-if="confirmState.loading" class="spinner" />
        <span>{{ confirmState.loading ? '处理中…' : confirmState.confirmText }}</span>
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.admin-banner{
  position:relative;overflow:hidden;display:flex;align-items:center;justify-content:space-between;
  gap:24px;padding:26px 28px;border-radius:20px;color:#fff;
  background:linear-gradient(120deg,#101b33 0%,#1a2b52 46%,#2c2a63 100%);
  border:1px solid rgba(255,255,255,.08);box-shadow:0 18px 46px rgba(8,20,48,.24);
  margin-bottom:18px;
}
.admin-banner::before{
  content:"";position:absolute;inset:0;pointer-events:none;
  background-image:radial-gradient(circle at 18% 30%,rgba(255,255,255,.38) 0 1px,transparent 1.6px),
    radial-gradient(circle at 72% 18%,rgba(255,255,255,.24) 0 1px,transparent 1.6px),
    radial-gradient(circle at 86% 72%,rgba(255,255,255,.3) 0 1px,transparent 1.6px);
  background-size:180px 180px,240px 240px,200px 200px;
}
.admin-banner-copy{position:relative;z-index:1;max-width:540px}
.admin-kicker{display:inline-flex;align-items:center;gap:8px;font-size:10.5px;letter-spacing:.22em;color:#8fb6ff}
.admin-kicker .pulse-dot{background:#55e0c0;box-shadow:0 0 0 4px rgba(85,224,192,.14)}
.admin-banner h2{font-size:22px;line-height:1.4;margin:12px 0 6px;letter-spacing:.01em}
.admin-banner p{font-size:13px;line-height:1.75;color:#b9c6de}
.admin-orbit{position:relative;width:150px;height:150px;flex:none;margin-right:12px}
.admin-ring{position:absolute;inset:0;border-radius:50%;border:1px solid rgba(143,182,255,.28)}
.admin-ring.ring-two{inset:24px;border-color:rgba(167,139,250,.34)}
.admin-core{
  position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
  width:52px;height:52px;border-radius:50%;display:grid;place-items:center;
  font-size:12px;font-weight:800;letter-spacing:.12em;
  background:linear-gradient(135deg,#165DFF,#8B5CF6);box-shadow:0 0 0 8px rgba(77,141,255,.1),0 10px 26px rgba(22,93,255,.42);
}
.admin-dot{position:absolute;width:8px;height:8px;border-radius:50%;background:#67e8f9;box-shadow:0 0 12px rgba(103,232,249,.9)}
.admin-dot.dot-one{top:12px;right:30px}
.admin-dot.dot-two{bottom:22px;left:20px;background:#c4b5fd;box-shadow:0 0 12px rgba(196,181,253,.9)}

.admin-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:20px}
.admin-stat{
  display:flex;align-items:center;gap:12px;padding:16px;border-radius:14px;
  background:var(--card);border:1px solid var(--card-border);box-shadow:var(--shadow-card);
}
.admin-stat-icon{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;flex:none}
.admin-stat-icon .icon{width:18px;height:18px}
.admin-stat-icon.is-blue{background:var(--primary-light);color:var(--primary)}
.admin-stat-icon.is-purple{background:rgba(139,92,246,.12);color:var(--accent)}
.admin-stat-icon.is-cyan{background:rgba(6,182,212,.12);color:var(--cyan)}
.admin-stat-icon.is-green{background:rgba(0,180,42,.1);color:var(--success)}
.admin-stat div{display:flex;flex-direction:column;line-height:1.25;min-width:0}
.admin-stat strong{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums}
.admin-stat span{font-size:12px;color:var(--text-mute);white-space:nowrap}
.admin-stat em{font-style:normal;font-size:10.5px;color:var(--text-mute);margin-left:auto;text-align:right;line-height:1.4}

.admin-tabs{
  display:flex;gap:4px;padding:5px;border-radius:12px;margin-bottom:20px;
  background:var(--soft);border:1px solid var(--border-soft);overflow-x:auto;
}
.admin-tab{
  display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 14px;border:none;border-radius:8px;
  background:transparent;color:var(--text-sub);font-size:13px;font-weight:500;white-space:nowrap;cursor:pointer;
  transition:background .18s,color .18s,box-shadow .18s;
}
.admin-tab .icon{width:16px;height:16px}
.admin-tab:hover{color:var(--text);background:var(--hover-soft)}
.admin-tab.active{background:var(--card);color:var(--primary);box-shadow:0 2px 10px rgba(15,42,92,.08);font-weight:600}

.admin-section{display:flex;flex-direction:column;gap:18px}
.badge-purple{background:rgba(139,92,246,.12);color:var(--accent)}
.admin-alert{
  display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-radius:12px;
  border:1px solid rgba(255,125,0,.24);background:rgba(255,125,0,.09);color:var(--text-sub);
}
.admin-alert .icon{width:19px;height:19px;color:var(--warning);margin-top:2px;flex:none}
.admin-alert strong{display:block;font-size:13px;color:var(--text);margin-bottom:2px}
.admin-alert p{font-size:12px;line-height:1.65}

.provider-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
.provider-card{padding:22px}
.provider-head{display:flex;align-items:flex-start;gap:12px}
.provider-mark{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;flex:none;background:var(--soft);color:var(--text-sub)}
.provider-mark .icon{width:22px;height:22px}
.provider-mark.is-google{color:#4285F4}
.provider-title{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
.provider-title strong{font-size:15px;font-weight:700}
.provider-title>span{display:flex;flex-wrap:wrap;gap:5px}
.provider-title .badge{font-size:10.5px;padding:2px 7px}
.provider-fields{display:flex;flex-direction:column;gap:13px;margin-top:18px}
.provider-warn{
  margin-top:12px;padding:9px 11px;border-radius:8px;font-size:11.5px;line-height:1.6;
  color:var(--warning);background:rgba(255,125,0,.09);
}
.provider-callback{margin-top:14px}
.provider-label{display:block;font-size:12.5px;font-weight:500;color:var(--text-sub);margin-bottom:7px}
.copy-line{display:flex;align-items:center;gap:6px;min-width:0}
.copy-line code{
  flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;
  padding:8px 10px;border-radius:8px;background:var(--soft);border:1px solid var(--border-soft);color:var(--text-sub);
}
.copy-btn{width:30px;height:30px;flex:none}
.copy-btn .icon{width:15px;height:15px}
.provider-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px;flex-wrap:wrap}
.provider-hint{font-size:11.5px;color:var(--text-mute)}
.provider-note{display:flex;align-items:flex-start;gap:10px;padding:14px 16px}
.provider-note .icon{width:17px;height:17px;color:var(--primary);margin-top:2px;flex:none}
.provider-note p{font-size:12px;line-height:1.7;color:var(--text-sub)}

.admin-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
.admin-section-head h2{font-size:17px;font-weight:700}
.admin-section-head p{font-size:12.5px;color:var(--text-mute);margin-top:4px}

.admin-empty{display:flex;flex-direction:column;align-items:center;text-align:center;padding:44px 24px;gap:7px}
.admin-empty.compact{padding:32px 20px}
.admin-empty-icon{width:52px;height:52px;border-radius:15px;display:grid;place-items:center;background:var(--primary-light);color:var(--primary);margin-bottom:4px}
.admin-empty-icon .icon{width:24px;height:24px}
.admin-empty h3{font-size:15px;font-weight:700}
.admin-empty p{font-size:12.5px;color:var(--text-mute);max-width:400px;line-height:1.7}
.admin-empty .btn{margin-top:8px}

.client-list{display:flex;flex-direction:column;gap:14px}
.client-card{padding:20px}
.client-head{display:flex;align-items:flex-start;gap:12px}
.client-mark{
  width:40px;height:40px;border-radius:11px;display:grid;place-items:center;flex:none;
  font-size:16px;font-weight:700;color:#fff;background:linear-gradient(135deg,var(--primary),var(--accent));
  box-shadow:0 5px 14px rgba(22,93,255,.22);
}
.client-title{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.client-title strong{font-size:14.5px;font-weight:700}
.client-title span{font-size:12px;color:var(--text-mute);line-height:1.5}
.client-title .muted{color:var(--text-mute)}
.client-badges{display:flex;gap:5px;flex-wrap:wrap;padding-top:4px}
.client-badges .badge{font-size:10.5px;padding:2px 7px}
.client-grid{
  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 22px;
  margin-top:16px;padding-top:16px;border-top:1px solid var(--border-soft);
}
.client-cell{min-width:0;display:flex;flex-direction:column;gap:4px}
.client-cell>span{font-size:11px;color:var(--text-mute)}
.client-cell p{font-size:12.5px;color:var(--text-sub);line-height:1.5}
.client-cell-wide{grid-column:1/-1}
.client-uri{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:var(--text-sub);line-height:1.65;word-break:break-all}
.client-actions{display:flex;gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid var(--border-soft);flex-wrap:wrap}

.endpoint-list{display:flex;flex-direction:column;gap:10px}
.endpoint-row{
  display:flex;align-items:center;gap:16px;padding:12px 14px;border-radius:11px;
  background:var(--soft);border:1px solid var(--border-soft);
}
.endpoint-copy{width:150px;flex:none;display:flex;flex-direction:column;gap:2px}
.endpoint-copy strong{font-size:12.5px;font-weight:600}
.endpoint-copy span{font-size:10.5px;color:var(--text-mute);line-height:1.45}
.endpoint-value{flex:1;min-width:0}
.endpoint-value code{font-size:11px}

.access-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:18px}
.access-title{font-size:15px;font-weight:700;margin-bottom:14px}
.access-steps{list-style:none;display:flex;flex-direction:column;gap:13px}
.access-steps li{display:flex;gap:12px}
.access-steps li>span{
  width:28px;height:28px;border-radius:8px;flex:none;display:grid;place-items:center;
  font-size:10.5px;font-weight:700;color:var(--primary);background:var(--primary-light);
}
.access-steps strong{display:block;font-size:12.5px;font-weight:600}
.access-steps p{font-size:11.5px;color:var(--text-mute);line-height:1.6;margin-top:2px}
.scope-list{display:flex;flex-direction:column;gap:12px}
.scope-row{display:flex;gap:10px}
.scope-key{
  flex:none;height:24px;padding:0 8px;border-radius:6px;display:inline-flex;align-items:center;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;font-weight:600;
  color:var(--primary);background:var(--primary-light);
}
.scope-row strong{display:block;font-size:12.5px}
.scope-row p{font-size:11.5px;color:var(--text-mute);line-height:1.6;margin-top:2px}
.access-note{display:flex;gap:9px;margin-top:16px;padding:12px;border-radius:10px;background:var(--soft)}
.access-note .icon{width:16px;height:16px;color:var(--primary);margin-top:2px;flex:none}
.access-note p{font-size:11.5px;color:var(--text-sub);line-height:1.65}
.access-code{
  padding:16px;border-radius:12px;background:#0c1425;color:#c9d6ee;overflow-x:auto;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;line-height:1.75;
}
.access-code code{white-space:pre}

.audit-list{display:flex;flex-direction:column}
.audit-row{display:flex;align-items:flex-start;gap:12px;padding:13px 2px;border-bottom:1px solid var(--border-soft)}
.audit-row:last-child{border-bottom:none;padding-bottom:0}
.audit-dot{width:7px;height:7px;border-radius:50%;margin-top:7px;flex:none;background:var(--primary);box-shadow:0 0 0 4px var(--primary-light)}
.audit-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.audit-copy strong{font-size:12.5px;font-weight:600}
.audit-copy span{font-size:11.5px;color:var(--text-mute);line-height:1.55;word-break:break-word}
.audit-meta{display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex:none;font-size:10.5px;color:var(--text-mute)}
.audit-meta em{font-style:normal}

.admin-list{display:flex;flex-direction:column}
.admin-row{display:flex;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid var(--border-soft)}
.admin-row:last-child{border-bottom:none}
.admin-avatar{
  width:38px;height:38px;border-radius:11px;flex:none;display:grid;place-items:center;
  font-size:14px;font-weight:700;color:#fff;background:linear-gradient(135deg,#165DFF,#8B5CF6);
}
.admin-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.admin-copy strong{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600}
.admin-copy span{font-size:11.5px;color:var(--text-mute);word-break:break-all}
.admin-grant{display:flex;align-items:flex-end;gap:12px;margin-top:18px;padding-top:18px;border-top:1px solid var(--border-soft)}
.admin-grant .field{flex:1}

.modal-form{display:flex;flex-direction:column;gap:15px}
.modal-textarea{height:auto;padding:10px 12px;line-height:1.65;resize:vertical}
.scope-picker{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
.scope-option{
  display:flex;align-items:flex-start;gap:9px;padding:11px 12px;border-radius:10px;
  border:1px solid var(--border);background:var(--card);text-align:left;cursor:pointer;
  transition:border-color .18s,background .18s;
}
.scope-option .icon{width:16px;height:16px;color:var(--text-mute);margin-top:2px;flex:none}
.scope-option span{display:flex;flex-direction:column;gap:1px}
.scope-option strong{font-size:12.5px;font-weight:600}
.scope-option em{font-style:normal;font-size:10.5px;color:var(--text-mute);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.scope-option.active{border-color:rgba(22,93,255,.46);background:var(--primary-light)}
.scope-option.active .icon{color:var(--primary)}
.public-toggle{display:flex;align-items:flex-start;gap:11px;padding:12px;border-radius:10px;background:var(--soft);cursor:pointer}
.public-toggle>span:last-child{display:flex;flex-direction:column;gap:2px}
.public-toggle strong{font-size:12.5px;font-weight:600}
.public-toggle em{font-style:normal;font-size:11px;color:var(--text-mute);line-height:1.55}
.modal-error{
  padding:9px 11px;border-radius:8px;font-size:12px;color:var(--danger);background:rgba(245,63,63,.09);
}
.secret-alert{display:flex;gap:10px;padding:12px;border-radius:10px;background:rgba(255,125,0,.09);margin-bottom:14px}
.secret-alert .icon{width:18px;height:18px;color:var(--warning);margin-top:2px;flex:none}
.secret-alert p{font-size:12px;color:var(--text-sub);line-height:1.65}
.secret-box{display:flex;align-items:center;gap:8px;padding:12px;border-radius:10px;background:var(--soft);border:1px solid var(--border)}
.secret-box code{flex:1;min-width:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;word-break:break-all;line-height:1.6}
.confirm-copy{font-size:13px;color:var(--text-sub);line-height:1.75}

@media(max-width:960px){
  .admin-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
  .provider-grid{grid-template-columns:1fr}
  .access-grid{grid-template-columns:1fr}
  .admin-orbit{display:none}
}
@media(max-width:640px){
  .admin-banner{padding:22px 20px}
  .admin-banner h2{font-size:19px}
  .admin-stats{grid-template-columns:1fr 1fr;gap:10px}
  .admin-stat{padding:13px;gap:9px;flex-wrap:wrap}
  .admin-stat em{width:100%;margin-left:47px;text-align:left}
  .admin-tabs{flex-wrap:wrap;overflow:visible}
  .admin-tab{flex:1 0 auto;justify-content:center;padding:0 10px;font-size:12.5px}
  .client-head{flex-wrap:wrap}
  .client-badges{order:3;width:100%;padding-left:52px}
  .client-head>.switch{margin-left:auto}
  .client-grid{grid-template-columns:1fr}
  .client-cell-wide{grid-column:auto}
  .endpoint-row{flex-direction:column;align-items:stretch;gap:7px}
  .endpoint-copy{width:auto}
  .admin-grant{flex-direction:column;align-items:stretch}
  .scope-picker{grid-template-columns:1fr}
  .audit-meta{display:none}
}
</style>
