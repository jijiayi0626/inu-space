<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { Button, Checkbox, Input } from 'fuxsto-design-pro';
import AppIcon from '../components/AppIcon.vue';
import BaseModal from '../components/BaseModal.vue';
import ContactVerifyModal from '../components/ContactVerifyModal.vue';
import PageHeader from '../components/PageHeader.vue';
import SkeletonBlock from '../components/SkeletonBlock.vue';
import { api } from '../lib/api';
import { dateLabel, number, timeLabel } from '../lib/format';
import { session, setUser } from '../lib/session';
import { toast } from '../lib/toast';
import { useAsyncData } from '../lib/useAsyncData';

const { data } = useAsyncData(({ force }) => api.get('/profile', { force }));

const user = computed(() => data.value?.user || session.user || {});
const counts = computed(() => data.value?.counts || { devices: 0, agreementsSigned: 0, agreementsPending: 0 });

const features = computed(() => session.site?.features || {});
const verificationAvailable = computed(
  () => features.value.verification !== false && session.site?.verification?.mode !== 'off',
);
const nameChangeDays = computed(() => Number(session.site?.nameChangeDays ?? 30));

const form = reactive({ name: '', email: '', bio: '' });
const saving = ref(false);

watch(
  data,
  (value) => {
    if (!value) return;
    form.name = value.user.name;
    form.email = value.user.email;
    form.bio = value.user.bio;
  },
  { immediate: true },
);

function resetForm() {
  if (!data.value) return;
  form.name = data.value.user.name;
  form.email = data.value.user.email;
  form.bio = data.value.user.bio;
}

function syncUser(nextUser) {
  setUser(nextUser);
  if (data.value) data.value = { ...data.value, user: nextUser };
}

async function save() {
  if (saving.value) return;
  saving.value = true;
  try {
    const result = await api.patch('/profile', { name: form.name, bio: form.bio });
    syncUser(result.user);
    toast('已保存修改');
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    saving.value = false;
  }
}

async function copyInuId() {
  const value = user.value.inuId || '';
  try {
    await navigator.clipboard.writeText(value);
    toast('INU ID 已复制到剪贴板');
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    toast('INU ID 已复制到剪贴板');
  }
}

const verifyOpen = ref(false);
const verifyAgreed = ref(false);
const verifying = ref(false);

function openVerify() {
  if (!verificationAvailable.value) {
    toast('实名认证通道暂未开放，请联系管理员', 'error');
    return;
  }
  verifyAgreed.value = false;
  verifyOpen.value = true;
}

async function confirmVerify() {
  if (!verifyAgreed.value) {
    toast('请先确认实名认证协议', 'error');
    return;
  }
  verifying.value = true;
  try {
    const result = await api.post('/profile/verify');
    syncUser(result.user);
    verifyOpen.value = false;
    toast('实名认证完成，实物商品兑换权限已解锁');
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    verifying.value = false;
  }
}

const avatarOpen = ref(false);
const avatarForm = reactive({ text: '', tone: 'blue' });
const avatarSaving = ref(false);
const avatarError = ref('');
const avatarTones = ['blue', 'purple', 'cyan', 'green', 'orange'];

function openAvatar() {
  if (features.value.avatar === false) {
    toast('头像更换功能暂未开放', 'error');
    return;
  }
  avatarForm.text = user.value.avatarText || '逸';
  avatarForm.tone = user.value.avatarTone || 'blue';
  avatarError.value = '';
  avatarOpen.value = true;
}

async function saveAvatar() {
  avatarError.value = '';
  const text = Array.from(avatarForm.text.trim()).slice(0, 2).join('');
  if (!text) {
    avatarError.value = '请输入 1–2 个字符作为头像';
    return;
  }
  avatarSaving.value = true;
  try {
    const result = await api.post('/profile/avatar', { text, tone: avatarForm.tone });
    syncUser(result.user);
    avatarOpen.value = false;
    toast('头像已更新');
  } catch (error) {
    avatarError.value = error.message;
  } finally {
    avatarSaving.value = false;
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
  syncUser(nextUser);
  form.email = nextUser.email;
}

const linkItems = computed(() => [
  {
    to: '/security',
    icon: 'shield',
    title: '账户安全',
    sub: `${user.value.twoFa ? '两步验证已开启' : '两步验证未开启'} · 登录保护`,
  },
  {
    to: '/devices',
    icon: 'device',
    title: '登录设备',
    sub: `${counts.value.devices} 台设备已绑定 · 管理登录记录`,
  },
  {
    to: '/connections',
    icon: 'globe',
    title: '授权应用',
    sub: '管理使用 INU 账号登录的第三方应用',
  },
  {
    to: '/notifications',
    icon: 'bell',
    title: '通知偏好',
    sub: '站内信、邮箱与免打扰设置',
  },
  {
    to: '/agreements',
    icon: 'file',
    title: '协议记录',
    sub: `${counts.value.agreementsSigned} 份已签署 · ${counts.value.agreementsPending} 份待签署`,
  },
  {
    to: '/member',
    icon: 'star',
    title: '会员中心',
    sub: `${user.value.tierLabel}等级 · ${number(user.value.particles)} 积分`,
  },
]);
</script>

<template>
  <PageHeader title="个人资料" sub="管理你的个人资料与账号关联信息。">
    <template #meta>
      <span v-if="user.inuId" class="badge badge-blue">{{ user.inuId }}</span>
      <span v-if="user.verified && verificationAvailable" class="badge badge-green">已认证</span>
    </template>
  </PageHeader>

  <section v-if="!data" class="card">
    <SkeletonBlock :rows="7" row-height="18px" />
  </section>

  <div v-else class="profile-grid">
    <div class="profile-main">
      <section id="basic" class="card">
        <div class="card-head">
          <h2>基本资料</h2>
          <span class="badge badge-blue">{{ user.tierLabel }} · {{ user.tierEn }}</span>
        </div>

        <div class="identity">
          <div class="avatar-xl" :class="`tone-${user.avatarTone || 'blue'}`">{{ user.avatarText }}<span class="avatar-dot" /></div>
          <div class="identity-info">
            <p class="identity-name">{{ user.name }}</p>
            <p class="identity-sub">
              加入 INU {{ data.joinedDays }} 天 · 上次登录 {{ timeLabel(user.lastLogin?.at) }} ·
              {{ user.lastLogin?.location || user.region }}
            </p>
          </div>
          <Button class="identity-btn" variant="secondary" size="sm" @click="openAvatar">
            更换头像
          </Button>
        </div>

        <div class="divider" />

        <form class="form-grid" @submit.prevent="save">
          <div class="field">
            <span class="field-label">昵称</span>
            <Input aria-label="昵称" v-model="form.name" type="text" maxlength="16" />
            <p class="hint">{{ nameChangeDays > 0 ? `昵称每 ${nameChangeDays} 天可修改一次` : '昵称修改次数不受限制' }}</p>
          </div>
          <div class="field">
            <span class="field-label">邮箱</span>
            <div class="input-inline">
              <Input aria-label="邮箱" v-model="form.email" type="email" readonly />
              <Button variant="ghost" size="sm" type="button" @click="openEmail">更换</Button>
            </div>
            <p class="hint">
              用于接收商品与安全通知 · {{ user.emailVerified === false ? '待验证' : '已验证' }}
            </p>
          </div>
          <div class="field span-2">
            <span class="field-label">个人签名</span>
            <Input aria-label="个人签名" v-model="form.bio" type="text" maxlength="60" placeholder="一句话介绍自己" />
            <p class="hint">最多 60 个字符，会展示在实名资料卡上</p>
          </div>
          <div class="field span-2">
            <span class="field-label">手机号</span>
            <div class="input-inline">
              <Input aria-label="手机号" type="tel" :model-value="user.phone || '未绑定手机号'" readonly />
              <span class="badge" :class="user.phone ? 'badge-green' : 'badge-red'">
                {{ user.phone ? '已绑定' : '未绑定' }}
              </span>
              <Button variant="ghost" size="sm" type="button" @click="openPhone">
                {{ user.phone ? '更换' : '去绑定' }}
              </Button>
            </div>
          </div>
          <div class="field span-2">
            <span class="field-label">INU ID</span>
            <div class="input-inline">
              <Input aria-label="INU ID" class="mono" type="text" :model-value="user.inuId" readonly />
              <Button variant="secondary" size="sm" type="button" @click="copyInuId">复制</Button>
            </div>
            <p class="hint">INU ID 是你的唯一账号标识，不可修改</p>
          </div>
        </form>

        <div class="card-actions">
          <Button variant="primary" type="button" :loading="saving" loading-text="保存中…" @click="save">
            保存修改
          </Button>
          <Button variant="secondary" type="button" :disabled="saving" @click="resetForm">取消</Button>
        </div>
      </section>

      <section v-if="verificationAvailable" id="verify" class="card">
        <div class="card-head">
          <h2>实名认证</h2>
          <span class="badge" :class="user.verified ? 'badge-green' : 'badge-red'">
            {{ user.verified ? '已实名' : '未实名' }}
          </span>
        </div>
        <p class="card-desc">
          完成认证后可解锁实物商品兑换、余额提现等权限，并显著提升账户安全等级。
        </p>

        <div v-if="user.verified" class="verify-strip stacked">
          <div class="verify-item">
            <AppIcon name="idcard" />
            <span class="verify-text"><strong>实名资料</strong><em>身份核验已通过，认证记录已归档</em></span>
          </div>
          <div class="verify-item">
            <AppIcon name="shield" />
            <span class="verify-text"><strong>权限状态</strong><em>实物商品兑换、余额提现已解锁</em></span>
          </div>
          <div class="verify-item">
            <AppIcon name="check" />
            <span class="verify-text"><strong>安全评分</strong><em>认证信息已计入账户安全评分</em></span>
          </div>
        </div>
        <div v-else class="verify-strip stacked">
          <div class="verify-item">
            <AppIcon name="idcard" />
            <span class="verify-text"><strong>认证材料</strong><em>身份证件 · 人脸识别</em></span>
          </div>
          <div class="verify-item">
            <AppIcon name="clock" />
            <span class="verify-text"><strong>预计耗时</strong><em>约 2 分钟</em></span>
          </div>
          <div class="verify-item">
            <AppIcon name="shield" />
            <span class="verify-text"><strong>隐私保护</strong><em>数据加密 · 仅用于核验</em></span>
          </div>
        </div>

        <div class="card-actions">
          <Button variant="primary" v-if="!user.verified" type="button" @click="openVerify">
            立即认证
          </Button>
          <RouterLink v-else class="btn btn-ghost" to="/supply">前往积分商城</RouterLink>
          <RouterLink class="btn btn-text" to="/agreements">查看认证协议</RouterLink>
        </div>
      </section>

      <section id="account-links" class="card">
        <div class="card-head">
          <h2>账号相关</h2>
          <span class="head-note">常用入口</span>
        </div>
        <div class="link-list">
          <RouterLink v-for="item in linkItems" :key="item.to" class="link-row" :to="item.to">
            <span class="quick-icon"><AppIcon :name="item.icon" /></span>
            <span class="link-copy">
              <span class="link-title">{{ item.title }}</span>
              <span class="link-sub">{{ item.sub }}</span>
            </span>
            <AppIcon name="chevron" class="chev" />
          </RouterLink>
        </div>
      </section>
    </div>

    <aside class="profile-side">
      <section id="account-summary" class="card">
        <div class="card-head">
          <h2>账户概况</h2>
          <span class="badge badge-green">状态良好</span>
        </div>
        <div class="sec-row">
          <span class="sec-icon"><AppIcon name="star" /></span>
          <div>
            <p class="sec-title">会员等级</p>
            <p class="sec-sub">{{ user.tierLabel }} · {{ user.tierEn }}</p>
          </div>
          <div class="sec-right"><RouterLink class="btn btn-text" to="/member">详情</RouterLink></div>
        </div>
        <div class="sec-row">
          <span class="sec-icon"><AppIcon name="chart" /></span>
          <div>
            <p class="sec-title">积分</p>
            <p class="sec-sub">用于等级与兑换</p>
          </div>
          <div class="sec-right"><strong class="num-strong">{{ number(user.particles) }}</strong></div>
        </div>
        <div class="sec-row">
          <span class="sec-icon"><AppIcon name="clock" /></span>
          <div>
            <p class="sec-title">加入</p>
            <p class="sec-sub">{{ dateLabel(user.createdAt) }}</p>
          </div>
          <div class="sec-right"><span class="badge badge-gray">{{ data.joinedDays }} 天</span></div>
        </div>
        <div class="sec-row">
          <span class="sec-icon"><AppIcon name="device" /></span>
          <div>
            <p class="sec-title">绑定设备</p>
            <p class="sec-sub">{{ counts.devices }} 台已绑定</p>
          </div>
          <div class="sec-right"><RouterLink class="btn btn-text" to="/devices">管理</RouterLink></div>
        </div>
      </section>

      <section id="profile-tips" class="card">
        <div class="card-head">
          <h2>资料完善建议</h2>
        </div>
        <div v-if="!user.verified && verificationAvailable" class="tip-item">
          <AppIcon name="idcard" /><span>完成实名认证，可解锁实物商品兑换与余额提现。</span>
        </div>
        <div v-if="!user.phone" class="tip-item">
          <AppIcon name="phone" /><span>绑定手机号，让账号找回与安全验证更可靠。</span>
        </div>
        <div class="tip-item">
          <AppIcon name="mail" /><span>确认邮箱可用，重要协议与账单将同步送达。</span>
        </div>
        <div class="tip-item">
          <AppIcon name="pen" /><span>写一句个人签名，让资料更完整。</span>
        </div>
        <div class="cta-stack">
          <RouterLink class="btn btn-primary" to="/security">前往账户安全</RouterLink>
          <RouterLink class="btn btn-ghost" to="/member">查看会员权益</RouterLink>
        </div>
      </section>
    </aside>
  </div>

  <BaseModal v-model="verifyOpen" title="实名认证" width="480px">
    <div class="modal-device">
      <span class="device-icon lg"><AppIcon name="idcard" /></span>
      <div>
        <p class="modal-device-name">{{ user.name }} · {{ user.inuId }}</p>
        <p class="modal-device-sub">实名用户身份核验</p>
      </div>
      <span class="badge badge-green">安全</span>
    </div>
    <dl class="detail-list">
      <div class="detail-row"><dt>认证项目</dt><dd>身份证件 · 人脸识别</dd></div>
      <div class="detail-row"><dt>所属地区</dt><dd>{{ user.region }}</dd></div>
      <div class="detail-row"><dt>解锁权限</dt><dd>实物商品兑换 · 余额提现</dd></div>
    </dl>
    <p class="card-note">
      <AppIcon name="info" />
      <span>确认后将完成身份核验，并解锁实物商品兑换能力。</span>
    </p>
    <div class="agree-row" @click="verifyAgreed = !verifyAgreed">
      <span class="agree-check" @click.stop>
        <Checkbox v-model="verifyAgreed" aria-label="同意实名认证服务协议" />
      </span>
      <span>我已阅读并同意《实名认证服务协议》，并确认以上认证信息真实有效。</span>
    </div>
    <template #footer>
      <Button variant="secondary" size="sm" type="button" @click="verifyOpen = false">取消</Button>
      <Button variant="primary" size="sm" type="button" :disabled="verifying" @click="confirmVerify">
        <span v-if="verifying" class="spinner" />
        {{ verifying ? '正在核验…' : '确认认证' }}
      </Button>
    </template>
  </BaseModal>

  <BaseModal v-model="avatarOpen" title="更换头像" width="440px">
    <div class="avatar-preview">
      <span class="avatar-xl" :class="`tone-${avatarForm.tone}`">{{ avatarForm.text || '逸' }}</span>
      <div>
        <p class="modal-device-name">{{ user.name }}</p>
        <p class="modal-device-sub">头像会显示在实名资料与授权页面</p>
      </div>
    </div>

    <div class="field">
      <span class="field-label">头像字符</span>
      <Input aria-label="头像字符" v-model="avatarForm.text" type="text" maxlength="2" placeholder="1–2 个字符" />
      <p class="hint">支持中文、字母或符号，最多 2 个字符</p>
    </div>

    <div class="field">
      <span class="field-label">头像配色</span>
      <div class="tone-row">
        <button
          v-for="tone in avatarTones"
          :key="tone"
          type="button"
          class="tone-dot"
          :class="[`tone-${tone}`, { active: avatarForm.tone === tone }]"
          :aria-label="tone"
          @click="avatarForm.tone = tone"
        />
      </div>
    </div>

    <p v-if="avatarError" class="form-error"><AppIcon name="shield" /><span>{{ avatarError }}</span></p>

    <template #footer>
      <Button variant="secondary" size="sm" type="button" @click="avatarOpen = false">取消</Button>
      <Button variant="primary" size="sm" type="button" :disabled="avatarSaving" @click="saveAvatar">
        <span v-if="avatarSaving" class="spinner" />
        {{ avatarSaving ? '保存中…' : '保存头像' }}
      </Button>
    </template>
  </BaseModal>

  <ContactVerifyModal v-model="phoneOpen" kind="phone" :current="user.phone" @updated="onContactUpdated" />
  <ContactVerifyModal v-model="emailOpen" kind="email" :current="user.email" @updated="onContactUpdated" />
</template>

<style scoped>
.avatar-xl.tone-blue{background:var(--fx-primary);color:var(--fx-primary-foreground)}
.avatar-xl.tone-purple{background:color-mix(in srgb, var(--fx-foreground) 82%, var(--fx-background));color:var(--fx-background)}
.avatar-xl.tone-cyan{background:color-mix(in srgb, var(--fx-foreground) 66%, var(--fx-background));color:var(--fx-background)}
.avatar-xl.tone-green{background:color-mix(in srgb, var(--fx-foreground) 50%, var(--fx-background));color:var(--fx-background)}
.avatar-xl.tone-orange{background:color-mix(in srgb, var(--fx-foreground) 34%, var(--fx-background));color:var(--fx-background)}
.avatar-preview{display:flex;align-items:center;gap:var(--s-3);margin-bottom:var(--s-4)}
.avatar-preview>div{min-width:0}
.tone-row{display:flex;gap:var(--s-2);flex-wrap:wrap}
.tone-dot{width:32px;height:32px;border-radius:var(--r-full);border:2px solid transparent;cursor:pointer}
.tone-dot.tone-blue{background:var(--fx-primary)}
.tone-dot.tone-purple{background:color-mix(in srgb, var(--fx-foreground) 82%, var(--fx-background))}
.tone-dot.tone-cyan{background:color-mix(in srgb, var(--fx-foreground) 66%, var(--fx-background))}
.tone-dot.tone-green{background:color-mix(in srgb, var(--fx-foreground) 50%, var(--fx-background))}
.tone-dot.tone-orange{background:color-mix(in srgb, var(--fx-foreground) 34%, var(--fx-background))}
.tone-dot.active{border-color:var(--fx-background);box-shadow:0 0 0 2px var(--fx-foreground)}
</style>
