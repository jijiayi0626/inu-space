<script setup>
import { computed, reactive, ref, watch } from 'vue';
import AppIcon from '../components/AppIcon.vue';
import BaseModal from '../components/BaseModal.vue';
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
const progress = computed(() => Math.min(99, Math.floor(((user.value.particles || 0) / 10000) * 100)));

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

async function save() {
  if (saving.value) return;
  saving.value = true;
  try {
    const result = await api.patch('/profile', { ...form });
    setUser(result.user);
    if (data.value) data.value = { ...data.value, user: result.user };
    toast('已保存修改，星际档案已同步');
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
    toast('星际 ID 已复制到剪贴板');
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    toast('星际 ID 已复制到剪贴板');
  }
}

const verifyOpen = ref(false);
const verifyAgreed = ref(false);
const verifying = ref(false);

function openVerify() {
  verifyAgreed.value = false;
  verifyOpen.value = true;
}

async function confirmVerify() {
  if (!verifyAgreed.value) {
    toast('请先确认星际公民认证协议', 'error');
    return;
  }
  verifying.value = true;
  try {
    const result = await api.post('/profile/verify');
    setUser(result.user);
    if (data.value) data.value = { ...data.value, user: result.user };
    verifyOpen.value = false;
    toast('星际公民认证完成，补给站权限已解锁');
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    verifying.value = false;
  }
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
    title: '星际终端',
    sub: `${counts.value.devices} 台设备已绑定 · 管理登录记录`,
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
    sub: `${user.value.tierLabel}等级 · ${number(user.value.particles)} INU 粒子`,
  },
]);
</script>

<template>
  <PageHeader title="个人资料" sub="管理你的星际公民档案与账号关联信息。">
    <template #meta>
      <span class="badge badge-blue">{{ user.inuId || 'INU·88210·0721' }}</span>
      <span v-if="user.verified" class="badge badge-green">已认证</span>
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
          <div class="avatar-xl">{{ user.avatarText }}<span class="avatar-dot" /></div>
          <div class="identity-info">
            <p class="identity-name">
              {{ user.name }}
              <span class="head-note">{{ user.orbit }}</span>
            </p>
            <p class="identity-sub">
              加入 INU 宇宙 {{ data.joinedDays }} 天 · 上次登录 {{ timeLabel(user.lastLogin?.at) }} ·
              {{ user.lastLogin?.location || user.region }}
            </p>
          </div>
          <button class="btn btn-ghost btn-sm identity-btn" @click="toast('头像更换通道正在接入星际网络')">
            更换头像
          </button>
        </div>

        <div class="divider" />

        <form class="form-grid" @submit.prevent="save">
          <div class="field">
            <label for="nickname">昵称</label>
            <input id="nickname" v-model="form.name" class="input" type="text" maxlength="16" />
            <p class="hint">昵称每 30 天可修改一次</p>
          </div>
          <div class="field">
            <label for="email">邮箱</label>
            <input id="email" v-model="form.email" class="input" type="email" />
            <p class="hint">用于接收星际补给与安全通知</p>
          </div>
          <div class="field span-2">
            <label for="bio">星际签名</label>
            <input id="bio" v-model="form.bio" class="input" type="text" maxlength="60" placeholder="写下一句属于你的宇宙注脚" />
            <p class="hint">最多 60 个字符，会展示在星际公民档案卡上</p>
          </div>
          <div class="field span-2">
            <label for="phone">手机号</label>
            <div class="input-inline">
              <input id="phone" class="input" type="tel" :value="user.phone || '未绑定手机号'" readonly />
              <span class="badge" :class="user.phone ? 'badge-green' : 'badge-red'">
                {{ user.phone ? '已绑定' : '未绑定' }}
              </span>
              <button class="btn btn-text" type="button" @click="toast('短信验证通道正在接入星际网络…')">
                去绑定
              </button>
            </div>
          </div>
          <div class="field span-2">
            <label for="inuid">星际 ID</label>
            <div class="input-inline">
              <input id="inuid" class="input mono" type="text" :value="user.inuId" readonly />
              <button class="btn btn-ghost btn-sm" type="button" @click="copyInuId">复制</button>
            </div>
            <p class="hint">星际 ID 是你在无限宇宙中的唯一坐标，不可修改</p>
          </div>
        </form>

        <div class="card-actions">
          <button class="btn btn-primary" type="button" :disabled="saving" @click="save">
            <span v-if="saving" class="spinner" />
            {{ saving ? '正在同步…' : '保存修改' }}
          </button>
          <button class="btn btn-ghost" type="button" :disabled="saving" @click="resetForm">取消</button>
        </div>
      </section>

      <section id="verify" class="card">
        <div class="card-head">
          <h2>星际公民身份认证</h2>
          <span class="badge" :class="user.verified ? 'badge-green' : 'badge-red'">
            {{ user.verified ? '已实名' : '未实名' }}
          </span>
        </div>
        <p class="card-desc">
          完成认证后可解锁星际补给站下单、星能提现等权限，并显著提升账户安全等级。
        </p>

        <div v-if="user.verified" class="verify-strip stacked">
          <div class="verify-item">
            <AppIcon name="idcard" />
            <span class="verify-text"><strong>星际公民档案</strong><em>身份核验已通过 · 档案编号 {{ user.orbit }}</em></span>
          </div>
          <div class="verify-item">
            <AppIcon name="shield" />
            <span class="verify-text"><strong>权限状态</strong><em>补给站下单、星能提现已解锁</em></span>
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
          <button v-if="!user.verified" class="btn btn-primary" type="button" @click="openVerify">立即认证</button>
          <RouterLink v-else class="btn btn-ghost" to="/supply">前往补给站</RouterLink>
          <RouterLink class="btn btn-text" to="/agreements">查看认证协议</RouterLink>
        </div>
      </section>

      <section id="account-links" class="card">
        <div class="card-head">
          <h2>账号相关</h2>
          <span class="head-note">QUICK LINKS</span>
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
          <div class="sec-right"><span class="badge badge-blue">{{ progress }}%</span></div>
        </div>
        <div class="sec-row">
          <span class="sec-icon"><AppIcon name="spark" /></span>
          <div>
            <p class="sec-title">INU 粒子</p>
            <p class="sec-sub">本周新增 120</p>
          </div>
          <div class="sec-right"><strong class="num-strong">{{ number(user.particles) }}</strong></div>
        </div>
        <div class="sec-row">
          <span class="sec-icon"><AppIcon name="clock" /></span>
          <div>
            <p class="sec-title">加入宇宙</p>
            <p class="sec-sub">{{ dateLabel(user.createdAt) }}</p>
          </div>
          <div class="sec-right"><span class="badge badge-gray">{{ data.joinedDays }} 天</span></div>
        </div>
        <div class="sec-row">
          <span class="sec-icon"><AppIcon name="device" /></span>
          <div>
            <p class="sec-title">绑定终端</p>
            <p class="sec-sub">1 台当前 · {{ Math.max(0, counts.devices - 1) }} 台可信</p>
          </div>
          <div class="sec-right"><RouterLink class="btn btn-text" to="/devices">管理</RouterLink></div>
        </div>
      </section>

      <section id="profile-tips" class="card">
        <div class="card-head">
          <h2>档案完善建议</h2>
        </div>
        <div v-if="!user.verified" class="tip-item">
          <AppIcon name="idcard" /><span>完成实名认证，可解锁补给站下单与星能提现。</span>
        </div>
        <div v-if="!user.phone" class="tip-item">
          <AppIcon name="phone" /><span>绑定手机号，让账号找回与安全验证更可靠。</span>
        </div>
        <div class="tip-item">
          <AppIcon name="mail" /><span>确认邮箱可用，重要协议与账单将同步送达。</span>
        </div>
        <div class="tip-item">
          <AppIcon name="spark" /><span>写一句星际签名，让你的坐标在宇宙中更独特。</span>
        </div>
        <div class="cta-stack">
          <RouterLink class="btn btn-primary" to="/security">前往账户安全</RouterLink>
          <RouterLink class="btn btn-ghost" to="/member">查看会员权益</RouterLink>
        </div>
      </section>
    </aside>
  </div>

  <BaseModal v-model="verifyOpen" title="星际公民认证" width="480px">
    <div class="modal-device">
      <span class="device-icon lg"><AppIcon name="idcard" /></span>
      <div>
        <p class="modal-device-name">{{ user.name }} · {{ user.inuId }}</p>
        <p class="modal-device-sub">星际公民身份核验 · 演示流程</p>
      </div>
      <span class="badge badge-green">安全</span>
    </div>
    <dl class="detail-list">
      <div class="detail-row"><dt>认证项目</dt><dd>身份证件 · 人脸识别</dd></div>
      <div class="detail-row"><dt>所属星域</dt><dd>{{ user.region }}</dd></div>
      <div class="detail-row"><dt>解锁权限</dt><dd>补给站下单 · 星能提现</dd></div>
    </dl>
    <p class="card-note">
      <AppIcon name="spark" />
      <span>演示环境：确认后将模拟完成星际公民核验，用于解锁补给站下单能力。</span>
    </p>
    <label class="agree-row">
      <input v-model="verifyAgreed" type="checkbox" class="check" />
      <span>我已阅读并同意《星际公民认证服务协议》，并确认以上档案信息真实有效。</span>
    </label>
    <template #footer>
      <button class="btn btn-ghost btn-sm" type="button" @click="verifyOpen = false">取消</button>
      <button class="btn btn-primary btn-sm" type="button" :disabled="verifying" @click="confirmVerify">
        <span v-if="verifying" class="spinner" />
        {{ verifying ? '正在核验…' : '确认认证' }}
      </button>
    </template>
  </BaseModal>
</template>
