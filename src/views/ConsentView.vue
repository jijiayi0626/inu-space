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
const userInitial = computed(() => user.value.avatarText || user.value.name?.slice(0, 1) || '星');

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
    <div class="consent-stars" aria-hidden="true" />
    <div class="consent-aurora" aria-hidden="true" />

    <main class="consent-card">
      <RouterLink class="consent-brand" to="/" aria-label="INU 星际通行证">
        <span class="brand-mark"><AppIcon name="orbit" /></span>
        <span class="brand-text">
          <span class="brand-name">INU</span>
          <span class="brand-sys">星际通行证</span>
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
        <RouterLink class="btn btn-primary btn-sm" to="/">返回星际通行证</RouterLink>
      </div>

      <template v-else-if="context">
        <div class="consent-head">
          <span class="consent-mark">{{ initial }}</span>
          <div class="consent-head-copy">
            <span class="consent-kicker">AUTHORIZATION REQUEST</span>
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
          授权后，{{ client.name }} 无法访问你的密码、星能余额、设备列表或其他应用的数据。
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

    <p class="consent-foot">© 2026 INU 无限宇宙 · 星际通行证</p>
  </div>
</template>

<style scoped>
.consent-page{
  position:relative;min-height:100vh;min-height:100svh;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:18px;padding:32px 20px;overflow:hidden;
  color:#e8edf7;background:#070d1a;
  font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;
}
.consent-stars{
  position:absolute;inset:0;pointer-events:none;opacity:.8;
  background-image:
    radial-gradient(circle at 16% 24%,rgba(255,255,255,.4) 0 1px,transparent 1.6px),
    radial-gradient(circle at 78% 12%,rgba(255,255,255,.28) 0 1px,transparent 1.6px),
    radial-gradient(circle at 88% 74%,rgba(255,255,255,.32) 0 1px,transparent 1.6px),
    radial-gradient(circle at 30% 86%,rgba(255,255,255,.2) 0 1px,transparent 1.6px);
  background-size:220px 220px,300px 300px,260px 260px,340px 340px;
}
.consent-aurora{
  position:absolute;inset:0;pointer-events:none;
  background:
    radial-gradient(560px 340px at 86% -8%,rgba(139,92,246,.34),transparent 62%),
    radial-gradient(520px 320px at 4% 14%,rgba(6,182,212,.24),transparent 62%),
    radial-gradient(640px 420px at 50% 118%,rgba(22,93,255,.24),transparent 64%);
}
.consent-card{
  position:relative;z-index:1;width:min(470px,100%);padding:26px 28px 24px;border-radius:24px;
  border:1px solid rgba(255,255,255,.1);
  background:linear-gradient(165deg,rgba(22,33,57,.96),rgba(10,17,31,.98));
  box-shadow:0 32px 80px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.05);
  backdrop-filter:blur(16px);
}
.consent-card .brand-mark{
  width:34px;height:34px;border-radius:10px;display:grid;place-items:center;color:#fff;
  background:linear-gradient(135deg,#165DFF,#8B5CF6);box-shadow:0 5px 14px rgba(22,93,255,.32);
}
.consent-card .brand-mark .icon{width:19px;height:19px}
.consent-card .brand-text{display:flex;flex-direction:column;line-height:1.16}
.consent-card .brand-name{
  font-size:14.5px;font-weight:800;letter-spacing:.14em;
  background:linear-gradient(90deg,#7db0ff,#c4b5fd);-webkit-background-clip:text;background-clip:text;color:transparent;
}
.consent-card .brand-sys{font-size:9.5px;letter-spacing:.2em;color:#7384a0;margin-top:1px}
.consent-brand{display:inline-flex;align-items:center;gap:9px;margin-bottom:22px;border-radius:10px}
.consent-loading{display:flex;flex-direction:column;align-items:center;gap:14px;padding:52px 0 44px}
.consent-loading p{font-size:13px;color:#8fa0bd}
.consent-loading .spinner,.consent-overlay .spinner{width:24px;height:24px;border-color:rgba(122,167,255,.22);border-top-color:#7aa7ff}

.consent-head{display:flex;align-items:center;gap:14px}
.consent-mark{
  width:54px;height:54px;border-radius:16px;flex:none;display:grid;place-items:center;
  font-size:22px;font-weight:700;color:#fff;
  background:linear-gradient(135deg,#165DFF,#8B5CF6);
  box-shadow:0 10px 26px rgba(22,93,255,.36);
}
.consent-head-copy{min-width:0}
.consent-kicker{font-size:9.5px;letter-spacing:.2em;color:#6f82a3}
.consent-head h1{font-size:21px;line-height:1.35;margin:4px 0 3px;letter-spacing:.01em;word-break:break-word}
.consent-head p{font-size:12.5px;color:#93a3c0}

.consent-return{
  display:flex;align-items:center;gap:8px;margin:18px 0 16px;padding:10px 12px;border-radius:10px;
  background:rgba(77,141,255,.1);border:1px solid rgba(77,141,255,.16);font-size:11.5px;color:#a7b4cb;
}
.consent-return .icon{width:15px;height:15px;color:#7aa7ff;flex:none}
.consent-return code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#c9d6ee;font-size:11px}

.consent-user{
  display:flex;align-items:center;gap:11px;padding:12px 14px;border-radius:12px;
  background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.07);
}
.consent-avatar{
  width:38px;height:38px;border-radius:11px;flex:none;display:grid;place-items:center;
  font-size:14px;font-weight:700;color:#fff;background:linear-gradient(135deg,#06B6D4,#165DFF);
}
.consent-user div{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.consent-user strong{font-size:13px;font-weight:600}
.consent-user em{font-style:normal;font-size:10.5px;color:#7f90ae;word-break:break-all}
.consent-user .badge{font-size:10px;padding:2px 7px;background:rgba(43,212,106,.12);color:#4be089}

.consent-scopes{margin-top:20px}
.consent-scopes h2{font-size:12px;font-weight:600;letter-spacing:.04em;color:#93a3c0;margin-bottom:10px}
.consent-scope{
  display:flex;align-items:flex-start;gap:11px;padding:11px 0;
  border-bottom:1px solid rgba(255,255,255,.06);
}
.consent-scope:last-child{border-bottom:none}
.consent-scope-icon{
  width:30px;height:30px;border-radius:9px;flex:none;display:grid;place-items:center;
  background:rgba(77,141,255,.13);color:#8fb6ff;
}
.consent-scope-icon .icon{width:15px;height:15px}
.consent-scope div{flex:1;min-width:0}
.consent-scope strong{display:block;font-size:12.5px;font-weight:600}
.consent-scope p{font-size:11px;color:#7f90ae;line-height:1.6;margin-top:1px}
.consent-check{width:15px;height:15px;color:#4be089;margin-top:7px;flex:none}

.consent-note{font-size:11px;line-height:1.7;color:#7384a0;margin-top:16px}
.consent-actions{display:grid;grid-template-columns:.8fr 1.2fr;gap:10px;margin-top:18px}
.consent-actions .btn{height:44px;border-radius:11px;font-size:13.5px}
.consent-actions .btn-primary{gap:6px}
.consent-actions .btn-primary .icon{width:15px;height:15px}
.consent-actions .btn-glass{border-color:rgba(255,255,255,.16);color:#d6def0;background:rgba(255,255,255,.06)}
.consent-actions .btn-glass:hover{background:rgba(255,255,255,.1)}
.consent-actions .spinner{border-color:rgba(255,255,255,.28);border-top-color:#fff}
.consent-legal{font-size:10.5px;line-height:1.65;color:#5f6f8b;text-align:center;margin-top:14px}

.consent-error{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:18px 0 8px}
.consent-error-icon{
  width:50px;height:50px;border-radius:15px;display:grid;place-items:center;
  background:rgba(255,107,107,.12);color:#ff8a8a;margin-bottom:4px;
}
.consent-error-icon .icon{width:23px;height:23px}
.consent-error h1{font-size:18px;font-weight:700}
.consent-error p{font-size:12.5px;color:#93a3c0;line-height:1.7;max-width:340px}
.consent-error .btn{margin-top:10px}

.consent-overlay{
  position:absolute;inset:0;z-index:2;border-radius:24px;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:13px;
  background:rgba(7,13,26,.82);backdrop-filter:blur(6px);
}
.consent-overlay p{font-size:12px;color:#a7b4cb}

.consent-foot{position:relative;z-index:1;font-size:10.5px;color:#4f5f7a;letter-spacing:.03em}

@media(max-width:520px){
  .consent-page{padding:18px 14px}
  .consent-card{padding:22px 18px 20px;border-radius:20px}
  .consent-head h1{font-size:19px}
  .consent-actions{grid-template-columns:1fr 1.35fr}
}
</style>
