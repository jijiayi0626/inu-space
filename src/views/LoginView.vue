<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppIcon from '../components/AppIcon.vue';
import BaseModal from '../components/BaseModal.vue';
import { api } from '../lib/api';
import { login } from '../lib/session';
import { toast } from '../lib/toast';

const route = useRoute();
const router = useRouter();

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const loading = ref(false);
const error = ref('');
const providers = ref([]);
const site = ref(null);
const oauthLoading = ref('');

const enabledProviders = computed(() => providers.value.filter((provider) => provider.enabled));
const demoVisible = computed(() => Boolean(site.value?.demoVisible && site.value?.demo?.email));
const notice = computed(() => {
  const value = site.value?.notice;
  return value?.enabled && value?.text ? value : null;
});
const loginWelcome = computed(() => site.value?.loginWelcome || '使用你的 INU 星际档案继续旅程。');
const footerText = computed(() => site.value?.footerText || '© 2026 INU 无限宇宙 · 星际通行证');

const OAUTH_ERRORS = {
  cancelled: '已取消第三方登录',
  state: '登录校验已过期，请重新发起',
  code: '授权码无效，请重新发起登录',
  email: '第三方账号没有可用的已验证邮箱',
  provider_unavailable: '该第三方登录暂不可用',
  provider_error: '第三方平台返回错误，请稍后重试',
  failed: '第三方登录失败，请稍后重试',
};

const redirect = computed(() => {
  const target = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
  return target.startsWith('/') ? target : '/';
});

onMounted(async () => {
  try {
    const data = await api.get('/auth/providers', { ttl: 0 });
    providers.value = Array.isArray(data.providers) ? data.providers : [];
    site.value = data.site || null;
    if (site.value?.demoVisible && site.value?.demo) {
      email.value = site.value.demo.email;
      password.value = site.value.demo.password;
    }
  } catch {
    providers.value = [];
  }

  const oauthError = typeof route.query.oauth_error === 'string' ? route.query.oauth_error : '';
  if (oauthError) {
    error.value = OAUTH_ERRORS[oauthError] || OAUTH_ERRORS.failed;
    const query = { ...route.query };
    delete query.oauth_error;
    delete query.provider;
    router.replace({ query });
  }
});

function startOAuth(id) {
  if (loading.value || oauthLoading.value) return;
  error.value = '';
  oauthLoading.value = id;
  const target = `/api/auth/oauth/${encodeURIComponent(id)}/start?redirect=${encodeURIComponent(redirect.value)}`;
  window.location.assign(target);
}

function fillDemo() {
  if (!site.value?.demo) return;
  email.value = site.value.demo.email;
  password.value = site.value.demo.password;
  error.value = '';
}

function navigateAfterLogin(target) {
  if (target.startsWith('/oauth/') || target.startsWith('/.well-known/')) {
    window.location.assign(target);
    return;
  }
  router.replace(target);
}

async function submit() {
  if (loading.value) return;
  error.value = '';

  if (!email.value.trim() || !password.value) {
    error.value = '请输入邮箱与密码';
    return;
  }

  loading.value = true;
  try {
    const user = await login(email.value.trim(), password.value);
    toast(`欢迎回来，${user.name}`);
    navigateAfterLogin(redirect.value);
  } catch (err) {
    error.value = err.message || '登录失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}

const resetOpen = ref(false);
const resetEmail = ref('');
const resetSending = ref(false);
const resetMessage = ref('');
const resetDone = ref(false);
const supportEmail = computed(() => site.value?.supportEmail || 'support@inu.space');

function openReset() {
  resetEmail.value = email.value.trim();
  resetMessage.value = '';
  resetDone.value = false;
  resetOpen.value = true;
}

async function submitReset() {
  if (resetSending.value) return;
  resetMessage.value = '';
  if (!resetEmail.value.trim()) {
    resetMessage.value = '请输入注册邮箱';
    return;
  }
  resetSending.value = true;
  try {
    const result = await api.post('/auth/password-reset', { email: resetEmail.value.trim() });
    resetDone.value = true;
    resetMessage.value = result.message || '找回申请已提交';
  } catch (err) {
    resetMessage.value = err.message || '提交失败，请稍后重试';
  } finally {
    resetSending.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <section class="login-visual">
      <div class="login-stars" aria-hidden="true" />
      <div class="login-orbit" aria-hidden="true">
        <span class="orbit-ring ring-a" />
        <span class="orbit-ring ring-b" />
        <span class="orbit-ring ring-c" />
        <span class="orbit-core" />
        <span class="orbit-dot dot-a" />
        <span class="orbit-dot dot-b" />
        <span class="orbit-dot dot-c" />
      </div>

      <RouterLink class="login-brand" to="/login" aria-label="INU 星际通行证">
        <span class="brand-mark"><AppIcon name="orbit" /></span>
        <span class="brand-text">
          <span class="brand-name">INU</span>
          <span class="brand-sys">星际通行证</span>
        </span>
      </RouterLink>

      <div class="login-copy">
        <span class="login-kicker"><span class="pulse-dot" />INU DEEP SPACE NETWORK</span>
        <h1>一张通行证，<br />抵达无限宇宙。</h1>
        <p class="login-lead">在一个账号里，管理你的星际公民档案、可信终端与每一份星尘记忆。</p>

        <ul class="login-points">
          <li>
            <span class="login-point-icon"><AppIcon name="shield" /></span>
            <span><strong>星尘级安全</strong><em>两步验证 · 终端守护 · 登录保护</em></span>
          </li>
          <li>
            <span class="login-point-icon"><AppIcon name="orbit" /></span>
            <span><strong>一处同步，全宇宙抵达</strong><em>通行证、补给站与协议记录实时同步</em></span>
          </li>
          <li>
            <span class="login-point-icon"><AppIcon name="spark" /></span>
            <span><strong>为探索者而生</strong><em>粒子、星能与会员权益，清晰可见</em></span>
          </li>
        </ul>
      </div>

      <p class="login-visual-foot">{{ footerText }}</p>
    </section>

    <section class="login-panel">
      <div class="login-card">
        <div class="login-card-head">
          <span class="login-card-mark"><AppIcon name="orbit" /></span>
          <p class="login-eyebrow">WELCOME BACK</p>
          <h2>进入星际通行证</h2>
          <p class="login-sub">{{ loginWelcome }}</p>
        </div>

        <div v-if="notice" class="login-notice" :class="`is-${notice.level}`">
          <AppIcon name="spark" />
          <span>{{ notice.text }}</span>
        </div>

        <form class="login-form" novalidate @submit.prevent="submit">
          <div class="field">
            <label for="loginEmail">邮箱</label>
            <div class="input-icon">
              <AppIcon name="mail" />
              <input
                id="loginEmail"
                v-model="email"
                class="input"
                type="email"
                autocomplete="username"
                placeholder="you@inu.space"
                :disabled="loading"
              />
            </div>
          </div>

          <div class="field">
            <label for="loginPassword">密码</label>
            <div class="input-icon">
              <AppIcon name="lock" />
              <input
                id="loginPassword"
                v-model="password"
                class="input"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="输入登录密码"
                :disabled="loading"
              />
              <button
                type="button"
                class="pwd-toggle"
                :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                @click="showPassword = !showPassword"
              >
                <AppIcon :name="showPassword ? 'eye-off' : 'eye'" />
              </button>
            </div>
          </div>

          <div class="login-row">
            <label class="login-check">
              <input type="checkbox" class="check" checked />
              <span>记住本次星际坐标</span>
            </label>
            <button type="button" class="btn-text login-forgot" @click="openReset">
              忘记密码？
            </button>
          </div>

          <p v-if="error" class="form-error" role="alert">
            <AppIcon name="shield" />
            <span>{{ error }}</span>
          </p>

          <button class="btn btn-primary login-submit" type="submit" :disabled="loading">
            <span v-if="loading" class="spinner" />
            <span>{{ loading ? '正在校准星际坐标…' : '进入通行证' }}</span>
            <AppIcon v-if="!loading" name="chevron" />
          </button>
        </form>

        <div v-if="enabledProviders.length" class="oauth-block">
          <div class="login-divider"><span>或使用第三方通行证</span></div>
          <div class="oauth-buttons" :class="{ single: enabledProviders.length === 1 }">
            <button
              v-for="provider in enabledProviders"
              :key="provider.id"
              type="button"
              class="oauth-btn"
              :disabled="loading || Boolean(oauthLoading)"
              @click="startOAuth(provider.id)"
            >
              <span class="oauth-icon" :class="`is-${provider.id}`">
                <span v-if="oauthLoading === provider.id" class="spinner oauth-spinner" />
                <AppIcon v-else :name="provider.id" />
              </span>
              <span>{{ oauthLoading === provider.id ? '正在连接…' : `${provider.label} 登录` }}</span>
              <span v-if="provider.backup && enabledProviders.length > 1" class="oauth-tag">备用</span>
            </button>
          </div>
        </div>

        <button v-if="demoVisible" type="button" class="demo-fill" @click="fillDemo">
          <span class="demo-fill-icon"><AppIcon name="idcard" /></span>
          <span class="demo-fill-copy">
            <strong>使用演示星际档案</strong>
            <em>{{ site.demo.email }} · {{ site.demo.password }}</em>
          </span>
          <AppIcon name="chevron" class="demo-fill-chev" />
        </button>

        <div class="login-divider"><span>受星际安全协议保护</span></div>

        <p class="login-legal">
          继续即表示你同意
          <RouterLink to="/agreements">《星际航行服务协议》</RouterLink>
          与
          <RouterLink to="/agreements">《隐私政策》</RouterLink>
        </p>
      </div>

      <div class="login-meta">
        <span><AppIcon name="shield" />端到端加密</span>
        <span><AppIcon name="globe" />边缘节点加速</span>
        <span><AppIcon name="clock" />7×24 星际响应</span>
      </div>
    </section>
  </div>

  <BaseModal v-model="resetOpen" title="找回星际通行证" width="440px">
    <div class="reset-form">
      <p class="reset-lead">
        提交注册邮箱后，管理员会在用户管理台收到找回申请，并为你重置登录密码。
        如急需处理，也可邮件联系 <a :href="`mailto:${supportEmail}`">{{ supportEmail }}</a>。
      </p>
      <div class="field">
        <label for="reset-email">注册邮箱</label>
        <input
          id="reset-email"
          v-model="resetEmail"
          class="input"
          type="email"
          autocomplete="username"
          placeholder="you@inu.space"
          :disabled="resetSending"
        />
      </div>
      <p v-if="resetMessage" class="reset-message" :class="{ done: resetDone }">{{ resetMessage }}</p>
    </div>
    <template #footer>
      <button class="btn btn-ghost" type="button" @click="resetOpen = false">
        {{ resetDone ? '关闭' : '取消' }}
      </button>
      <button v-if="!resetDone" class="btn btn-primary" type="button" :disabled="resetSending" @click="submitReset">
        <span v-if="resetSending" class="spinner" />
        <span>{{ resetSending ? '提交中…' : '提交找回申请' }}</span>
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.reset-form{display:flex;flex-direction:column;gap:14px}
.reset-lead{font-size:12.5px;line-height:1.75;color:var(--text-sub)}
.reset-lead a{color:var(--primary);text-decoration:none}
.reset-message{padding:9px 11px;border-radius:8px;font-size:12px;line-height:1.6;color:var(--warning);background:rgba(255,125,0,.09)}
.reset-message.done{color:var(--success);background:rgba(0,180,42,.08)}
.login-notice{
  display:flex;align-items:flex-start;gap:9px;margin:16px 0 0;
  padding:10px 12px;border-radius:10px;font-size:12px;line-height:1.65;
  color:var(--primary);background:var(--primary-light);border:1px solid rgba(22,93,255,.16);
}
.login-notice .icon{width:15px;height:15px;margin-top:2px;flex:none}
.login-notice.is-success{color:var(--success);background:rgba(0,180,42,.08);border-color:rgba(0,180,42,.18)}
.login-notice.is-warn{color:var(--warning);background:rgba(255,125,0,.08);border-color:rgba(255,125,0,.2)}
</style>
