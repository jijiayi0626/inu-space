<script setup>
import { computed, ref } from 'vue';
import { Button, Input } from 'fuxsto-design-pro';
import AppIcon from '../components/AppIcon.vue';
import BaseModal from '../components/BaseModal.vue';
import PageHeader from '../components/PageHeader.vue';
import SkeletonBlock from '../components/SkeletonBlock.vue';
import { api } from '../lib/api';
import { number, moneyParts, timeLabel } from '../lib/format';
import { session, setUser } from '../lib/session';
import { toast } from '../lib/toast';
import { useAsyncData } from '../lib/useAsyncData';

const { data, reload } = useAsyncData(({ force }) => api.get('/overview', { force }));

const user = computed(() => data.value?.user || session.user || {});
const wallet = computed(() => data.value?.wallet || { balanceCents: user.value.starEnergyCents || 0, cardLast4: '0721' });
const balance = computed(() => moneyParts(wallet.value.balanceCents));
const particles = computed(() => user.value.particles || 0);
const progress = computed(() => Math.min(99, Math.floor((particles.value / 10000) * 100)));
const remaining = computed(() => Math.max(0, 10000 - particles.value));

const rechargeOpen = ref(false);
const rechargeAmount = ref(0);
const rechargeMethod = ref('inu_pay');
const recharging = ref(false);
const rechargeError = ref('');

const presets = computed(() => session.site?.wallet?.presets || [50, 100, 200, 500, 1000]);
const rechargeEnabled = computed(() => session.site?.features?.recharge !== false);
const verificationAvailable = computed(
  () => session.site?.features?.verification !== false && session.site?.verification?.mode !== 'off',
);
const paymentMode = computed(() => session.site?.payment?.mode || 'mock');

function openRecharge() {
  if (!rechargeEnabled.value) {
    toast('余额充值暂未开放，请联系管理员', 'error');
    return;
  }
  rechargeAmount.value = presets.value[1] || presets.value[0] || 100;
  rechargeMethod.value = 'inu_pay';
  rechargeError.value = '';
  rechargeOpen.value = true;
}

async function submitRecharge() {
  const amount = Number(rechargeAmount.value);
  if (!Number.isFinite(amount) || amount < 10) {
    rechargeError.value = '单次充值至少 10';
    return;
  }
  rechargeError.value = '';
  recharging.value = true;
  try {
    const result = await api.post('/wallet/recharge', {
      amountCents: Math.round(amount * 100),
      method: rechargeMethod.value,
    });
    if (session.user) {
      setUser({ ...session.user, starEnergyCents: result.balanceCents });
    }
    rechargeOpen.value = false;
    toast(result.paid ? `${amount} 已到账` : result.message || '充值订单已创建');
    await reload({ silent: true });
  } catch (error) {
    rechargeError.value = error.message;
  } finally {
    recharging.value = false;
  }
}

const activitiesOpen = ref(false);
const activities = ref([]);
const activitiesLoading = ref(false);

async function openActivities() {
  activitiesOpen.value = true;
  activitiesLoading.value = true;
  try {
    const result = await api.get('/overview/activities?limit=50', { force: true, ttl: 0 });
    activities.value = result.activities || [];
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    activitiesLoading.value = false;
  }
}

const quicks = computed(() => [
  {
    to: '/profile#verify',
    icon: 'idcard',
    title: '实名认证',
    sub: user.value.verified
      ? '已认证 · 权限已解锁'
      : verificationAvailable.value
        ? '未实名 · 立即认证'
        : '认证通道暂未开放',
  },
  {
    to: '/profile#basic',
    icon: 'pen',
    title: '修改昵称',
    sub: `昵称每 ${session.site?.nameChangeDays ?? 30} 天可修改一次`,
  },
  {
    to: '/devices',
    icon: 'device',
    title: '登录设备',
    sub: data.value ? `${data.value.counts?.devices ?? 0} 台设备已绑定` : '正在读取…',
  },
  {
    to: '/agreements',
    icon: 'file',
    title: '协议记录',
    sub: data.value ? `${data.value.counts?.agreementsSigned ?? 0} 份协议已签署` : '正在读取…',
  },
]);
</script>

<template>
  <PageHeader
    :title="`欢迎回来，${user.name || '用户'}`"
    sub="这里是你的账号概览，最近的安全与订单动态都在这里。"
  >
    <template #meta>
      <span class="badge badge-blue">{{ user.tierLabel || '普通' }}会员</span>
      <span class="head-date">{{ data?.dateLabel || '今天' }}</span>
    </template>
  </PageHeader>

  <div class="overview-grid">
    <article class="wallet-card">
      <div class="wallet-top">
        <span class="wallet-label">账户余额</span>
        <span class="wallet-chip"><AppIcon name="wallet" />INU</span>
      </div>
      <div class="wallet-amount">{{ balance.integer }}<span>.{{ balance.decimal }}</span></div>
      <div class="wallet-foot">
        <span class="wallet-num">INU ···· {{ wallet.cardLast4 }}</span>
        <div class="wallet-actions">
          <Button variant="secondary" size="sm" class="btn-wallet" @click="openRecharge">充值</Button>
          <RouterLink class="btn btn-sm btn-glass" to="/supply">明细</RouterLink>
        </div>
      </div>
    </article>

    <article class="stat-card">
      <div class="stat-top">
        <span class="stat-icon"><AppIcon name="star" /></span>
      </div>
      <div>
        <p class="stat-name">积分</p>
        <p class="stat-value">{{ number(particles) }}</p>
      </div>
      <p class="stat-foot">用于升级会员等级与兑换商品</p>
    </article>

    <article class="stat-card">
      <div class="stat-top">
        <span class="stat-icon"><AppIcon name="idcard" /></span>
        <span class="badge badge-blue">{{ user.tierEn || 'BASIC' }}</span>
      </div>
      <div>
        <p class="stat-name">会员等级</p>
        <p class="stat-value">{{ user.tierLabel || '普通' }}</p>
      </div>
      <div>
        <div class="progress"><span :style="{ width: `${progress}%` }" /></div>
        <p class="stat-foot">距离白银等级还需 {{ number(remaining) }} 积分</p>
      </div>
    </article>
  </div>

  <div class="overview-row">
    <section class="card quick-card">
      <div class="card-head">
        <h2>快捷操作</h2>
        <span class="head-note">{{ quicks.length }} 项</span>
      </div>
      <div class="quick-grid">
        <RouterLink v-for="item in quicks" :key="item.title" class="quick-tile" :to="item.to">
          <span class="quick-icon"><AppIcon :name="item.icon" /></span>
          <span class="quick-text">
            <span class="quick-title">{{ item.title }}</span>
            <span class="quick-sub">{{ item.sub }}</span>
          </span>
        </RouterLink>
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h2>最近动态</h2>
        <button class="btn btn-text" @click="openActivities">查看全部</button>
      </div>

      <div v-if="!data" class="feed">
        <SkeletonBlock :rows="4" />
      </div>
      <div v-else class="feed">
        <div v-for="item in data?.activities || []" :key="item.id" class="feed-item">
          <span class="feed-chip" :class="`chip-${item.tone}`"><AppIcon :name="item.icon" /></span>
          <div class="feed-body">
            <p class="feed-title">{{ item.title }}</p>
            <p class="feed-sub">{{ item.detail }}</p>
          </div>
          <span class="feed-time">{{ timeLabel(item.occurredAt) }}</span>
        </div>
        <div v-if="!data?.activities?.length" class="inline-empty">
          <span class="inline-empty-icon"><AppIcon name="clock" /></span>
          <h3>动态还很安静</h3>
          <p>完成一次认证或下单，新的记录就会出现在这里。</p>
        </div>
      </div>
    </section>
  </div>

  <BaseModal v-model="rechargeOpen" title="余额充值" width="460px">
    <div class="modal-device">
      <span class="device-icon lg"><AppIcon name="wallet" /></span>
      <div>
        <p class="modal-device-name">账户余额</p>
        <p class="modal-device-sub">当前余额 {{ balance.integer }}.{{ balance.decimal }}</p>
      </div>
      <span class="badge badge-green">{{ paymentMode === 'mock' ? '演示支付' : '在线支付' }}</span>
    </div>

    <div class="field">
      <span class="field-label">充值金额</span>
      <div class="preset-grid">
        <button
          v-for="preset in presets"
          :key="preset"
          type="button"
          class="preset-btn"
          :class="{ active: Number(rechargeAmount) === Number(preset) }"
          @click="rechargeAmount = preset"
        >
          +{{ preset }}
        </button>
      </div>
      <Input :model-value="rechargeAmount" class="mono" type="number" min="10" max="50000" step="1" @update:model-value="rechargeAmount = Number($event)" />
      <p class="hint">单次充值 10–50000{{ paymentMode === 'mock' ? ' · 演示支付会即时到账' : '' }}</p>
    </div>

    <div class="field">
      <span class="field-label">支付方式</span>
      <div class="method-row">
        <button
          v-for="item in [
            { key: 'inu_pay', label: 'INU 支付' },
            { key: 'alipay', label: '支付宝' },
            { key: 'wechat', label: '微信支付' },
          ]"
          :key="item.key"
          type="button"
          class="method-btn"
          :class="{ active: rechargeMethod === item.key }"
          @click="rechargeMethod = item.key"
        >
          {{ item.label }}
        </button>
      </div>
    </div>

    <p v-if="rechargeError" class="form-error"><AppIcon name="shield" /><span>{{ rechargeError }}</span></p>

    <template #footer>
      <Button variant="secondary" size="sm" type="button" @click="rechargeOpen = false">取消</Button>
      <Button variant="primary" size="sm" type="button" :disabled="recharging" @click="submitRecharge">
        <span v-if="recharging" class="spinner" />
        {{ recharging ? '正在支付…' : `确认充值 ${rechargeAmount || 0}` }}
      </Button>
    </template>
  </BaseModal>

  <BaseModal v-model="activitiesOpen" title="全部动态" width="520px">
    <div v-if="activitiesLoading" class="feed">
      <SkeletonBlock :rows="6" />
    </div>
    <div v-else class="feed feed-scroll">
      <div v-for="item in activities" :key="item.id" class="feed-item">
        <span class="feed-chip" :class="`chip-${item.tone}`"><AppIcon :name="item.icon" /></span>
        <div class="feed-body">
          <p class="feed-title">{{ item.title }}</p>
          <p class="feed-sub">{{ item.detail }}</p>
        </div>
        <span class="feed-time">{{ timeLabel(item.occurredAt) }}</span>
      </div>
      <div v-if="!activities.length" class="inline-empty">
        <span class="inline-empty-icon"><AppIcon name="clock" /></span>
        <h3>暂无更多动态</h3>
        <p>完成认证、签署协议或兑换商品后，记录会出现在这里。</p>
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.preset-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--s-2);margin-bottom:var(--s-2)}
.preset-btn{
  height:36px;border-radius:var(--r-sm);border:none;background:var(--fx-muted);
  color:var(--fx-muted-foreground);font-size:var(--fx-text-xs);font-weight:var(--fx-weight-medium);cursor:pointer;
  transition:background-color var(--dur-fast) var(--ease-standard),color var(--dur-fast) var(--ease-standard);
}
.preset-btn:hover{background:var(--fx-accent);color:var(--fx-foreground)}
.preset-btn.active{background:var(--fx-primary);color:var(--fx-primary-foreground)}
.method-row{display:flex;gap:var(--s-2);flex-wrap:wrap}
.method-btn{
  flex:1;min-width:96px;height:38px;border-radius:var(--r-sm);border:none;
  background:var(--fx-muted);color:var(--fx-muted-foreground);font-size:var(--fx-text-xs);font-weight:var(--fx-weight-medium);cursor:pointer;
  transition:background-color var(--dur-fast) var(--ease-standard),color var(--dur-fast) var(--ease-standard);
}
.method-btn.active{background:var(--fx-primary);color:var(--fx-primary-foreground)}
.feed-scroll{max-height:56vh;overflow-y:auto}
@media (max-width:520px){.preset-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
</style>
