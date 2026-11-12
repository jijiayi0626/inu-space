<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import AppIcon from '../components/AppIcon.vue';
import { api } from '../lib/api';

const route = useRoute();
const loading = ref(true);
const submitting = ref(false);
const autoApproving = ref(false);
const context = ref(null);
const error = ref('');

const client = computed(() => context.value?.client || {});
const user = computed(() => context.value?.user || {});
const scopes = computed(() => context.value?.scopes || []);
const initial = computed(() => client.value.name?.slice(0, 1) || '应');
const userInitial = computed(() => user.value.avatarText || user.value.name?.slice(0, 1) || 'U');

const PARAM_KEYS = [
  'client_id',
  'redirect_uri',
  'response_type',
  'scope',
  'state',
  'code_challenge',
  'code_challenge_method',
  'prompt',
];

function oauthParams() {
  const params = {};
  for (const key of PARAM_KEYS) {
    const value = route.query[key];
    if (typeof value === 'string' && value) params[key] = value;
  }
  return params;
}

function queryString() {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(oauthParams())) search.set(key, value);
  return search.toString();
}

async function decide(decision) {
  if (submitting.value) return;
  submitting.value = true;
  error.value = '';
  try {
    const result = await api.post('/oauth/authorize/decision', {
      ...oauthParams(),
      decision,
    });
    if (result.redirect) {
      window.location.assign(result.redirect);
      return;
    }
    error.value = '授权结果无效，请返回应用重试';
  } catch (err) {
    autoApproving.value = false;
    error.value = err.message || '授权失败，请稍后重试';
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  const params = oauthParams();
  if (!params.client_id) {
    error.value = '授权请求缺少 client_id，请返回应用重新发起登录';
    loading.value = false;
    return;
  }

  try {
    const data = await api.get(`/oauth/authorize/context?${queryString()}`, { ttl: 0, force: true });
    if (data.redirect) {
      window.location.assign(data.redirect);
      return;
    }
    context.value = data;
    if (data.approved) {
      autoApproving.value = true;
      await decide('approve');
    }
  } catch (err) {
    error.value = err.message || '无法读取授权请求，请稍后重试';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="consent-page">
    <main class="consent-card">
      <RouterLink class="consent-brand" to="/" aria-label="INU 账号中心">
        <span class="brand-mark"><AppIcon name="grid" /></span>
        <span class="brand-text">
          <span class="brand-name">INU</span>
          <span class="brand-sys">账号中心</span>
        </span>
      </RouterLink>

      <div v-if="loading" class="consent-loading">
        <span class="spinner" />
        <p>正在校验授权请求…</p>
      </div>

      <div v-else-if="error" class="consent-error">
        <span class="consent-error-icon"><AppIcon name="x" /></span>
        <h1>授权未能继续</h1>
        <p>{{ error }}</p>
        <RouterLink class="btn btn-primary btn-sm" to="/">返回账号中心</RouterLink>
      </div>

      <template v-else-if="context">
        <div class="consent-head">
          <span class="consent-mark">{{ initial }}</span>
          <div class="consent-head-copy">
            <span class="consent-kicker">授权请求</span>
            <h1>{{ client.name }}</h1>
            <p>希望使用你的 INU 账号登录</p>
          </div>
        </div>

        <div class="consent-return">
          <AppIcon name="globe" />
          <span>授权后将返回 <code>{{ client.redirectHost }}</code></span>
        </div>

        <div class="consent-user">
          <span class="consent-avatar">{{ userInitial }}</span>
          <div>
            <strong>{{ user.name }}</strong>
            <em>{{ user.inuId }} · {{ user.tierLabel }}</em>
          </div>
          <span class="badge badge-green">已登录</span>
        </div>

        <div class="consent-scopes">
          <h2>将向该应用提供</h2>
          <div v-for="scope in scopes" :key="scope.key" class="consent-scope">
            <span class="consent-scope-icon">
              <AppIcon :name="scope.key === 'email' ? 'mail' : 'user'" />
            </span>
            <div>
              <strong>{{ scope.label }}</strong>
              <p>{{ scope.description }}</p>
            </div>
            <AppIcon name="check" class="consent-check" />
          </div>
        </div>

        <p class="consent-note">
          授权后，{{ client.name }} 无法访问你的密码、余额、设备列表或其他应用的数据。
          你可以随时在应用中撤销授权。
        </p>

        <div class="consent-actions">
          <button class="btn btn-glass" type="button" :disabled="submitting" @click="decide('deny')">拒绝</button>
          <button class="btn btn-primary" type="button" :disabled="submitting" @click="decide('approve')">
            <span v-if="submitting" class="spinner" />
            <span>{{ submitting ? '处理中…' : '授权并继续' }}</span>
            <AppIcon name="chevron" />
          </button>
        </div>

        <p class="consent-legal">
          继续即表示你同意 INU 向该应用提供上述信息。请仅授权给你信任的应用。
        </p>
      </template>

      <div v-if="autoApproving" class="consent-overlay">
        <span class="spinner" />
        <p>已完成过授权，正在返回应用…</p>
      </div>
    </main>

    <p class="consent-foot">© 2026 INU 账号中心</p>
  </div>
</template>

<style scoped>
.consent-page{
  position:relative;min-height:100vh;min-height:100svh;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:var(--s-4);padding:var(--s-8) var(--s-5);
  color:var(--fx-foreground);background:var(--fx-muted);
  font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;
}
.consent-card{
  position:relative;z-index:1;width:min(470px,100%);padding:var(--s-6);
  border-radius:var(--r-md);background:var(--fx-surface);
  box-shadow:var(--fx-shadow-2);
}
[data-theme="dark"] .consent-card{box-shadow:inset 0 0 0 1px var(--fx-border),var(--fx-shadow-2)}
.consent-card .brand-mark{
  width:34px;height:34px;border-radius:var(--r-sm);display:grid;place-items:center;
  color:var(--fx-primary-foreground);background:var(--fx-primary);
}
.consent-card .brand-mark .icon{width:19px;height:19px}
.consent-card .brand-text{display:flex;flex-direction:column;line-height:1.2}
.consent-card .brand-name{font-size:var(--fx-text-sm);font-weight:var(--fx-weight-bold);letter-spacing:-.01em}
.consent-card .brand-sys{font-size:var(--fx-text-2xs);color:var(--fx-muted-foreground);margin-top:1px}
.consent-brand{display:inline-flex;align-items:center;gap:var(--s-2);margin-bottom:var(--s-5);border-radius:var(--r-sm)}
.consent-loading{display:flex;flex-direction:column;align-items:center;gap:var(--s-3);padding:var(--s-10) 0}
.consent-loading p{font-size:var(--fx-text-sm);color:var(--fx-muted-foreground)}
.consent-loading .spinner,.consent-overlay .spinner{
  width:24px;height:24px;border-color:var(--fx-border);border-top-color:var(--fx-foreground);
}

.consent-head{display:flex;align-items:center;gap:var(--s-3)}
.consent-mark{
  width:52px;height:52px;border-radius:var(--r-md);flex:none;display:grid;place-items:center;
  font-size:var(--fx-text-xl);font-weight:var(--fx-weight-medium);
  color:var(--fx-primary-foreground);background:var(--fx-primary);
}
.consent-head-copy{min-width:0}
.consent-kicker{font-size:var(--fx-text-2xs);letter-spacing:.1em;color:var(--fx-muted-foreground)}
.consent-head h1{font-size:var(--fx-text-xl);line-height:1.35;margin:var(--s-1) 0 2px;font-weight:var(--fx-weight-bold);word-break:break-word}
.consent-head p{font-size:var(--fx-text-sm);color:var(--fx-muted-foreground)}

.consent-return{
  display:flex;align-items:center;gap:var(--s-2);margin:var(--s-4) 0 var(--s-3);padding:var(--s-2) var(--s-3);
  border-radius:var(--r-sm);background:var(--fx-muted);font-size:var(--fx-text-xs);color:var(--fx-muted-foreground);
}
.consent-return .icon{width:15px;height:15px;color:var(--fx-muted-foreground);flex:none}
.consent-return code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--fx-foreground);font-size:var(--fx-text-xs)}

.consent-user{
  display:flex;align-items:center;gap:var(--s-3);padding:var(--s-3);
  border-radius:var(--r-sm);background:var(--fx-muted);
}
.consent-avatar{
  width:36px;height:36px;border-radius:var(--r-full);flex:none;display:grid;place-items:center;
  font-size:var(--fx-text-sm);font-weight:var(--fx-weight-medium);
  color:var(--fx-primary-foreground);background:var(--fx-primary);
}
.consent-user div{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.consent-user strong{font-size:var(--fx-text-sm);font-weight:var(--fx-weight-medium)}
.consent-user em{font-style:normal;font-size:var(--fx-text-2xs);color:var(--fx-muted-foreground);word-break:break-all}

.consent-scopes{margin-top:var(--s-5)}
.consent-scopes h2{font-size:var(--fx-text-xs);font-weight:var(--fx-weight-medium);color:var(--fx-muted-foreground);margin-bottom:var(--s-2)}
.consent-scope{
  display:flex;align-items:flex-start;gap:var(--s-3);padding:var(--s-3) 0;
  border-bottom:1px solid var(--fx-border);
}
.consent-scope:last-child{border-bottom:none}
.consent-scope-icon{
  width:30px;height:30px;border-radius:var(--r-xs);flex:none;display:grid;place-items:center;
  background:var(--fx-muted);color:var(--fx-muted-foreground);
}
.consent-scope-icon .icon{width:15px;height:15px}
.consent-scope div{flex:1;min-width:0}
.consent-scope strong{display:block;font-size:var(--fx-text-sm);font-weight:var(--fx-weight-medium)}
.consent-scope p{font-size:var(--fx-text-xs);color:var(--fx-muted-foreground);line-height:1.6;margin-top:1px}
.consent-check{width:15px;height:15px;color:var(--fx-success);margin-top:6px;flex:none}

.consent-note{font-size:var(--fx-text-xs);line-height:1.7;color:var(--fx-muted-foreground);margin-top:var(--s-4)}
.consent-actions{display:grid;grid-template-columns:.8fr 1.2fr;gap:var(--s-2);margin-top:var(--s-4)}
.consent-actions .btn{height:44px}
.consent-actions .btn-primary .icon{width:15px;height:15px}
.consent-actions .spinner{border-color:color-mix(in srgb, var(--fx-primary-foreground) 30%, transparent);border-top-color:var(--fx-primary-foreground)}
.consent-legal{font-size:var(--fx-text-2xs);line-height:1.65;color:var(--fx-muted-foreground);text-align:center;margin-top:var(--s-3)}

.consent-error{display:flex;flex-direction:column;align-items:center;text-align:center;gap:var(--s-2);padding:var(--s-4) 0 var(--s-2)}
.consent-error-icon{
  width:48px;height:48px;border-radius:var(--r-md);display:grid;place-items:center;
  background:var(--fx-destructive-soft);color:var(--fx-destructive);margin-bottom:var(--s-1);
}
.consent-error-icon .icon{width:22px;height:22px}
.consent-error h1{font-size:var(--fx-text-lg);font-weight:var(--fx-weight-medium)}
.consent-error p{font-size:var(--fx-text-sm);color:var(--fx-muted-foreground);line-height:1.7;max-width:340px}
.consent-error .btn{margin-top:var(--s-2)}

.consent-overlay{
  position:absolute;inset:0;z-index:2;border-radius:var(--r-md);display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:var(--s-3);
  background:color-mix(in srgb, var(--fx-surface) 86%, transparent);backdrop-filter:blur(6px);
}
.consent-overlay p{font-size:var(--fx-text-xs);color:var(--fx-muted-foreground)}

.consent-foot{position:relative;z-index:1;font-size:var(--fx-text-2xs);color:var(--fx-muted-foreground)}

@media(max-width:520px){
  .consent-page{padding:var(--s-4) var(--s-3)}
  .consent-card{padding:var(--s-5) var(--s-4)}
  .consent-head h1{font-size:var(--fx-text-lg)}
  .consent-actions{grid-template-columns:1fr 1.35fr}
}
</style>
