<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppIcon from '../components/AppIcon.vue';
import { api } from '../lib/api';
import { login } from '../lib/session';
import { toast } from '../lib/toast';

const route = useRoute();
const router = useRouter();

const email = ref('xiaoyiyi@inu.space');
const password = ref('inu2026');
const showPassword = ref(false);
const loading = ref(false);
const error = ref('');
const providers = ref([]);
const oauthLoading = ref('');

const enabledProviders = computed(() => providers.value.filter((provider) => provider.enabled));

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
  email.value = 'xiaoyiyi@inu.space';
  password.value = 'inu2026';
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

      <p class="login-visual-foot">© 2026 INU 无限宇宙 · 星际通行证</p>
    </section>

    <section class="login-panel">
      <div class="login-card">
        <div class="login-card-head">
          <span class="login-card-mark"><AppIcon name="orbit" /></span>
          <p class="login-eyebrow">WELCOME BACK</p>
          <h2>进入星际通行证</h2>
          <p class="login-sub">使用你的 INU 星际档案继续旅程。</p>
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
            <button type="button" class="btn-text login-forgot" @click="toast('找回通道正在接入星际网络')">
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

        <button type="button" class="demo-fill" @click="fillDemo">
          <span class="demo-fill-icon"><AppIcon name="idcard" /></span>
          <span class="demo-fill-copy">
            <strong>使用演示星际档案</strong>
            <em>xiaoyiyi@inu.space · inu2026</em>
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
</template>
