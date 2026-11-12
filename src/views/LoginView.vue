<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Button, Input } from 'fuxsto-design-pro';
import { Lock, Mail } from 'lucide-vue-next';
import AppIcon from '../components/AppIcon.vue';
import BaseModal from '../components/BaseModal.vue';
import { api } from '../lib/api';
import { login } from '../lib/session';
import { toast } from '../lib/toast';

const route = useRoute();
const router = useRouter();

const email = ref('');
const password = ref('');
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
const loginWelcome = computed(() => site.value?.loginWelcome || '登录后管理你的资料、安全与设备。');
const footerText = computed(() => site.value?.footerText || '© 2026 INU 账号中心');

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

      <RouterLink class="login-brand" to="/login" aria-label="INU 账号中心">
        <span class="brand-mark"><AppIcon name="grid" /></span>
        <span class="brand-text">
          <span class="brand-name">INU</span>
          <span class="brand-sys">账号中心</span>
        </span>
      </RouterLink>

      <div class="login-copy">
        <span class="login-kicker"><span class="pulse-dot" />INU 账号中心</span>
        <h1>一个账号，<br />连接你的全部服务。</h1>
        <p class="login-lead">在一个账号里，管理你的资料、登录设备与账号安全。</p>

        <ul class="login-points">
          <li>
            <span class="login-point-icon"><AppIcon name="shield" /></span>
            <span><strong>账户安全</strong><em>两步验证 · 设备管理 · 登录保护</em></span>
          </li>
          <li>
            <span class="login-point-icon"><AppIcon name="refresh" /></span>
            <span><strong>一处更新，处处同步</strong><em>资料、订单与协议记录实时同步</em></span>
          </li>
          <li>
            <span class="login-point-icon"><AppIcon name="chart" /></span>
            <span><strong>权益清晰可见</strong><em>积分、余额与会员等级，随时可查</em></span>
          </li>
        </ul>
      </div>

      <p class="login-visual-foot">{{ footerText }}</p>
    </section>

    <section class="login-panel">
      <div class="login-card">
        <div class="login-card-head">
          <span class="login-card-mark"><AppIcon name="user" /></span>
          <p class="login-eyebrow">账号登录</p>
          <h2>登录 INU 账号</h2>
          <p class="login-sub">{{ loginWelcome }}</p>
        </div>

        <div v-if="notice" class="login-notice" :class="`is-${notice.level}`">
          <AppIcon name="info" />
          <span>{{ notice.text }}</span>
        </div>

        <form class="login-form" novalidate @submit.prevent="submit">
          <div class="field">
            <span class="field-label">邮箱</span>
            <Input aria-label="邮箱"
              v-model="email"
              type="email"
              autocomplete="username"
              placeholder="you@inu.space"
              :disabled="loading"
              :prefix-icon="Mail"
            />
          </div>

          <div class="field">
            <span class="field-label">密码</span>
            <Input aria-label="密码"
              v-model="password"
              type="password"
              autocomplete="current-password"
              placeholder="输入登录密码"
              :disabled="loading"
              :prefix-icon="Lock"
            />
          </div>

          <div class="login-row">
            <button type="button" class="btn-text login-forgot" @click="openReset">
              忘记密码
            </button>
          </div>

          <p v-if="error" class="form-error" role="alert">
            <AppIcon name="shield" />
            <span>{{ error }}</span>
          </p>

          <Button
            class="login-submit"
            variant="primary"
            type="submit"
            block
            :loading="loading"
            loading-text="正在登录…"
          >
            登录
            <template #suffix>
              <AppIcon name="chevron" />
            </template>
          </Button>
        </form>

        <div v-if="enabledProviders.length" class="oauth-block">
          <div class="login-divider"><span>或使用第三方账号</span></div>
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
            <strong>使用演示账号</strong>
            <em>{{ site.demo.email }} · {{ site.demo.password }}</em>
          </span>
          <AppIcon name="chevron" class="demo-fill-chev" />
        </button>

        <div class="login-divider"><span>受安全验证保护</span></div>

        <p class="login-legal">
          继续即表示你同意
          <RouterLink to="/agreements">《服务协议》</RouterLink>
          与
          <RouterLink to="/agreements">《隐私政策》</RouterLink>
        </p>
      </div>

      <div class="login-meta">
        <span><AppIcon name="lock" />安全连接</span>
        <span><AppIcon name="globe" />多端同步</span>
        <span><AppIcon name="clock" />在线支持</span>
      </div>
    </section>
  </div>

  <BaseModal v-model="resetOpen" title="找回密码" width="440px">
    <div class="reset-form">
      <p class="reset-lead">
        提交注册邮箱后，管理员会在用户管理台收到找回申请，并为你重置登录密码。
        如急需处理，也可邮件联系 <a :href="`mailto:${supportEmail}`">{{ supportEmail }}</a>。
      </p>
      <div class="field">
        <span class="field-label">注册邮箱</span>
        <Input aria-label="注册邮箱"
          v-model="resetEmail"
          type="email"
          autocomplete="username"
          placeholder="you@inu.space"
          :disabled="resetSending"
        />
      </div>
      <p v-if="resetMessage" class="reset-message" :class="{ done: resetDone }">{{ resetMessage }}</p>
    </div>
    <template #footer>
      <Button variant="secondary" type="button" @click="resetOpen = false">
        {{ resetDone ? '关闭' : '取消' }}
      </Button>
      <Button
        v-if="!resetDone"
        variant="primary"
        type="button"
        :loading="resetSending"
        loading-text="提交中…"
        @click="submitReset"
      >
        提交找回申请
      </Button>
    </template>
  </BaseModal>
</template>

<style scoped>
.reset-form{display:flex;flex-direction:column;gap:var(--s-4)}
.reset-lead{font-size:var(--fx-text-sm);line-height:1.75;color:var(--fx-muted-foreground)}
.reset-lead a{color:var(--fx-foreground);text-decoration:underline;text-underline-offset:3px}
.reset-message{padding:var(--s-2) var(--s-3);border-radius:var(--r-sm);font-size:var(--fx-text-xs);line-height:1.6;color:var(--fx-warning);background:color-mix(in srgb, var(--fx-warning) 10%, transparent)}
.reset-message.done{color:var(--fx-success);background:color-mix(in srgb, var(--fx-success) 10%, transparent)}
.login-notice{
  display:flex;align-items:flex-start;gap:var(--s-2);margin:var(--s-4) 0 0;
  padding:var(--s-2) var(--s-3);border-radius:var(--r-sm);font-size:var(--fx-text-xs);line-height:1.65;
  color:var(--fx-foreground);background:var(--fx-muted);
}
.login-notice .icon{width:15px;height:15px;margin-top:2px;flex:none;color:var(--fx-muted-foreground)}
.login-notice.is-success{color:var(--fx-success);background:color-mix(in srgb, var(--fx-success) 10%, transparent)}
.login-notice.is-warn{color:var(--fx-warning);background:color-mix(in srgb, var(--fx-warning) 10%, transparent)}
</style>
