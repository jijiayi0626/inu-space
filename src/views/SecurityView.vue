<script setup>
import { computed, reactive, ref, watch } from 'vue';
import AppIcon from '../components/AppIcon.vue';
import BaseModal from '../components/BaseModal.vue';
import ContactVerifyModal from '../components/ContactVerifyModal.vue';
import PageHeader from '../components/PageHeader.vue';
import SkeletonBlock from '../components/SkeletonBlock.vue';
import { api } from '../lib/api';
import { timeLabel } from '../lib/format';
import { session, setUser } from '../lib/session';
import { toast } from '../lib/toast';
import { useAsyncData } from '../lib/useAsyncData';

const { data, reload } = useAsyncData(({ force }) => api.get('/security', { force }));

const user = computed(() => data.value?.user || session.user || {});
const score = computed(() => data.value?.score ?? '—');
const features = computed(() => session.site?.features || {});

const twoFa = ref(false);
const twoFaSaving = ref(false);
const guards = reactive({ geo: true, device: true, sensitive: false });
const guardSaving = reactive({ geo: false, device: false, sensitive: false });

watch(
  data,
  (value) => {
    if (!value) return;
    twoFa.value = value.user.twoFa;
    guards.geo = value.guards.geo;
    guards.device = value.guards.device;
    guards.sensitive = value.guards.sensitive;
  },
  { immediate: true },
);

async function toggleTwoFa(event) {
  const enabled = event.target.checked;
  twoFaSaving.value = true;
  try {
    const result = await api.post('/security/2fa', { enabled });
    twoFa.value = result.twoFa;
    if (session.user) setUser({ ...session.user, twoFa: result.twoFa });
    toast(enabled ? '两步验证已开启，个人资料更安全了' : '两步验证已关闭');
    reload({ silent: true });
  } catch (error) {
    event.target.checked = twoFa.value;
    toast(error.message, 'error');
  } finally {
    twoFaSaving.value = false;
  }
}

async function toggleGuard(key, event) {
  const enabled = event.target.checked;
  guardSaving[key] = true;
  try {
    await api.patch('/security/guards', { key, enabled });
    guards[key] = enabled;
    if (session.user) setUser({ ...session.user, guards: { ...session.user.guards, [key]: enabled } });
    const labels = { geo: '异地登录验证', device: '新设备验证', sensitive: '敏感操作二次确认' };
    toast(`${labels[key]}已${enabled ? '开启' : '关闭'}`);
    reload({ silent: true });
  } catch (error) {
    event.target.checked = guards[key];
    toast(error.message, 'error');
  } finally {
    guardSaving[key] = false;
  }
}

const pwdOpen = ref(false);
const pwd = reactive({ current: '', next: '', confirm: '' });
const pwdError = ref('');
const pwdSaving = ref(false);

function openPassword() {
  pwd.current = '';
  pwd.next = '';
  pwd.confirm = '';
  pwdError.value = '';
  pwdOpen.value = true;
}

async function changePassword() {
  pwdError.value = '';
  if (!pwd.current || !pwd.next) {
    pwdError.value = '请填写当前密码与新密码';
    return;
  }
  if (pwd.next.length < 8 || !/[A-Za-z]/.test(pwd.next) || !/\d/.test(pwd.next)) {
    pwdError.value = '新密码至少 8 位，且需同时包含字母与数字';
    return;
  }
  if (pwd.next !== pwd.confirm) {
    pwdError.value = '两次输入的新密码不一致';
    return;
  }

  pwdSaving.value = true;
  try {
    const result = await api.post('/security/password', { current: pwd.current, next: pwd.next });
    pwdOpen.value = false;
    toast(result.message || '登录密码已更新');
    reload({ silent: true });
  } catch (error) {
    pwdError.value = error.message;
  } finally {
    pwdSaving.value = false;
  }
}

const phoneOpen = ref(false);
const emailOpen = ref(false);

function openPhone() {
  if (features.value.phoneBind === false) {
    toast('手机号绑定功能暂未开放', 'error');
    return;
  }
  phoneOpen.value = true;
}

function openEmail() {
  if (features.value.emailChange === false) {
    toast('安全邮箱更换功能暂未开放', 'error');
    return;
  }
  emailOpen.value = true;
}

function onContactUpdated(nextUser) {
  if (session.user) setUser(nextUser);
  reload({ silent: true });
}

const logsOpen = ref(false);
const allLogs = ref([]);
const logsLoading = ref(false);

async function openAllLogs() {
  logsOpen.value = true;
  logsLoading.value = true;
  try {
    const result = await api.get('/security/logs?limit=100', { force: true, ttl: 0 });
    allLogs.value = result.logs || [];
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    logsLoading.value = false;
  }
}
</script>

<template>
  <PageHeader title="账户安全" sub="管理登录凭证、两步验证与登录保护策略。">
    <template #meta>
      <span class="badge badge-green">安全评分 {{ score }}</span>
      <span class="head-date">上次登录 {{ timeLabel(user.lastLogin?.at) }}</span>
    </template>
  </PageHeader>

  <section v-if="!data" class="card">
    <SkeletonBlock :rows="8" row-height="18px" />
  </section>

  <div v-else class="profile-grid">
    <div class="profile-main">
      <section id="score" class="card">
        <div class="card-head">
          <h2>账户安全评分</h2>
          <span class="badge badge-orange">{{ data.scoreLabel }}</span>
        </div>
        <div class="score-line">
          <span class="score-value">{{ data.score }}<small>/ 100</small></span>
          <span class="badge badge-green">满分 100</span>
        </div>
        <div class="progress"><span :style="{ width: `${data.score}%` }" /></div>
        <div class="score-grid">
          <div v-for="item in data.items" :key="item.label" class="score-item">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
        <p class="card-note">
          <AppIcon name="shield" />
          <span>开启两步验证并绑定手机号，可将安全评分提升至 96 分。</span>
        </p>
      </section>

      <section id="credentials" class="card">
        <div class="card-head">
          <h2>登录凭证</h2>
          <span class="badge badge-blue">3 项</span>
        </div>

        <div class="sec-row">
          <span class="sec-icon"><AppIcon name="lock" /></span>
          <div>
            <p class="sec-title">登录密码</p>
            <p class="sec-sub">
              上次更新于 {{ data.credentials.passwordAgeDays }} 天前 · 建议每 180 天更换一次
            </p>
          </div>
          <div class="sec-right">
            <button class="btn btn-text" type="button" @click="openPassword">修改</button>
          </div>
        </div>

        <div class="sec-row">
          <span class="sec-icon"><AppIcon name="phone" /></span>
          <div>
            <p class="sec-title">手机号</p>
            <p class="sec-sub">用于登录验证与账号找回</p>
          </div>
          <div class="sec-right">
            <span class="badge" :class="data.credentials.phone ? 'badge-green' : 'badge-red'">
              {{ data.credentials.phone ? (data.credentials.phoneVerified ? '已验证' : '待验证') : '未绑定' }}
            </span>
            <button
              class="btn btn-text"
              type="button"
              @click="openPhone"
            >
              {{ data.credentials.phone ? '更换' : '去绑定' }}
            </button>
          </div>
        </div>

        <div class="sec-row">
          <span class="sec-icon"><AppIcon name="mail" /></span>
          <div>
            <p class="sec-title">安全邮箱</p>
            <p class="sec-sub">{{ data.credentials.email }}</p>
          </div>
          <div class="sec-right">
            <span class="badge" :class="data.credentials.emailVerified ? 'badge-green' : 'badge-orange'">
              {{ data.credentials.emailVerified ? '已验证' : '待验证' }}
            </span>
            <button class="btn btn-text" type="button" @click="openEmail">
              更换
            </button>
          </div>
        </div>
      </section>

      <section id="twofa" class="card">
        <div class="card-head">
          <h2>两步验证</h2>
          <span class="badge" :class="twoFa ? 'badge-green' : 'badge-gray'">
            {{ twoFa ? '已开启' : '未开启' }}
          </span>
        </div>
        <p class="card-desc">登录时在密码之外增加一道动态验证码，即使密码泄露也能守住个人资料。</p>

        <div class="sec-row">
          <span class="sec-icon"><AppIcon name="shield" /></span>
          <div>
            <p class="sec-title">动态验证码</p>
            <p class="sec-sub">使用验证器应用生成 6 位动态码</p>
          </div>
          <div class="sec-right">
            <label class="switch" aria-label="两步验证开关">
              <input type="checkbox" :checked="twoFa" :disabled="twoFaSaving" @change="toggleTwoFa" />
              <span class="track" /><span class="thumb" />
            </label>
          </div>
        </div>

        <div class="verify-strip stacked">
          <div class="verify-item">
            <AppIcon name="phone" />
            <span class="verify-text"><strong>验证器应用</strong><em>任意验证器应用 · 推荐</em></span>
          </div>
          <div class="verify-item">
            <AppIcon name="lock" />
            <span class="verify-text"><strong>备用密钥</strong><em>开启后生成 8 组一次性恢复码</em></span>
          </div>
          <div class="verify-item">
            <AppIcon name="mail" />
            <span class="verify-text"><strong>恢复方式</strong><em>安全邮箱 · 人工核验</em></span>
          </div>
        </div>
        <p class="notify-note"><AppIcon name="shield" />建议为 INU 账号开启两步验证</p>
      </section>
    </div>

    <aside class="profile-side">
      <section id="guard" class="card">
        <div class="card-head">
          <h2>登录保护</h2>
          <span class="badge badge-green">策略实时生效</span>
        </div>
        <div class="sec-row">
          <div>
            <p class="sec-title">异地登录验证</p>
            <p class="sec-sub">新地点登录时要求二次验证</p>
          </div>
          <div class="sec-right">
            <label class="switch" aria-label="异地登录验证">
              <input
                type="checkbox"
                :checked="guards.geo"
                :disabled="guardSaving.geo"
                @change="toggleGuard('geo', $event)"
              />
              <span class="track" /><span class="thumb" />
            </label>
          </div>
        </div>
        <div class="sec-row">
          <div>
            <p class="sec-title">新设备验证</p>
            <p class="sec-sub">首次登录需短信或邮箱确认</p>
          </div>
          <div class="sec-right">
            <label class="switch" aria-label="新设备验证">
              <input
                type="checkbox"
                :checked="guards.device"
                :disabled="guardSaving.device"
                @change="toggleGuard('device', $event)"
              />
              <span class="track" /><span class="thumb" />
            </label>
          </div>
        </div>
        <div class="sec-row">
          <div>
            <p class="sec-title">敏感操作二次确认</p>
            <p class="sec-sub">提现、解绑与协议签署前复核</p>
          </div>
          <div class="sec-right">
            <label class="switch" aria-label="敏感操作二次确认">
              <input
                type="checkbox"
                :checked="guards.sensitive"
                :disabled="guardSaving.sensitive"
                @change="toggleGuard('sensitive', $event)"
              />
              <span class="track" /><span class="thumb" />
            </label>
          </div>
        </div>
      </section>

      <section id="logs" class="card">
        <div class="card-head">
          <h2>安全日志</h2>
          <button class="btn btn-text" @click="openAllLogs">查看全部</button>
        </div>
        <div class="feed">
          <div v-for="log in data.logs" :key="log.id" class="feed-item">
            <span class="feed-chip" :class="`chip-${log.tone}`"><AppIcon :name="log.icon" /></span>
            <div class="feed-body">
              <p class="feed-title">{{ log.event }}</p>
              <p class="feed-sub">{{ log.detail }}</p>
            </div>
            <span class="feed-time">{{ timeLabel(log.occurredAt) }}</span>
          </div>
        </div>
      </section>

      <section id="advice" class="card">
        <div class="card-head">
          <h2>安全建议</h2>
        </div>
        <div v-for="item in data.advice" :key="item.text" class="tip-item">
          <AppIcon :name="item.icon" /><span>{{ item.text }}</span>
        </div>
      </section>
    </aside>
  </div>

  <BaseModal v-model="pwdOpen" title="修改登录密码">
    <form id="pwdForm" @submit.prevent="changePassword">
      <div class="field">
        <label for="oldPwd">当前密码</label>
        <input
          id="oldPwd"
          v-model="pwd.current"
          class="input"
          type="password"
          placeholder="输入当前登录密码"
          autocomplete="current-password"
        />
      </div>
      <div class="field">
        <label for="newPwd">新密码</label>
        <input
          id="newPwd"
          v-model="pwd.next"
          class="input"
          type="password"
          placeholder="至少 8 位，包含字母与数字"
          autocomplete="new-password"
        />
        <p class="hint">建议使用 12 位以上，且不与其它站点重复</p>
      </div>
      <div class="field">
        <label for="confirmPwd">确认新密码</label>
        <input
          id="confirmPwd"
          v-model="pwd.confirm"
          class="input"
          type="password"
          placeholder="再次输入新密码"
          autocomplete="new-password"
        />
      </div>
      <p v-if="pwdError" class="form-error"><AppIcon name="shield" /><span>{{ pwdError }}</span></p>
    </form>
    <template #footer>
      <button class="btn btn-ghost btn-sm" type="button" @click="pwdOpen = false">取消</button>
      <button class="btn btn-primary btn-sm" type="submit" form="pwdForm" :disabled="pwdSaving">
        <span v-if="pwdSaving" class="spinner" />
        {{ pwdSaving ? '正在更新…' : '更新密码' }}
      </button>
    </template>
  </BaseModal>

  <BaseModal v-model="logsOpen" title="全部安全日志" width="560px">
    <div v-if="logsLoading" class="feed">
      <SkeletonBlock :rows="6" />
    </div>
    <div v-else class="feed feed-scroll">
      <div v-for="log in allLogs" :key="log.id" class="feed-item">
        <span class="feed-chip" :class="`chip-${log.tone}`"><AppIcon :name="log.icon" /></span>
        <div class="feed-body">
          <p class="feed-title">{{ log.event }}</p>
          <p class="feed-sub">{{ log.detail }}</p>
        </div>
        <span class="feed-time">{{ timeLabel(log.occurredAt) }}</span>
      </div>
      <div v-if="!allLogs.length" class="inline-empty">
        <span class="inline-empty-icon"><AppIcon name="clock" /></span>
        <h3>暂无安全日志</h3>
        <p>登录、密码与保护策略的变化都会记录在这里。</p>
      </div>
    </div>
  </BaseModal>

  <ContactVerifyModal v-model="phoneOpen" kind="phone" :current="data?.credentials?.phone" @updated="onContactUpdated" />
  <ContactVerifyModal v-model="emailOpen" kind="email" :current="data?.credentials?.email" @updated="onContactUpdated" />
</template>

<style scoped>
.feed-scroll{max-height:56vh;overflow-y:auto}
</style>
