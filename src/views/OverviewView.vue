<script setup>
import { computed, ref } from 'vue';
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
    toast('星能充值暂未开放，请联系管理员', 'error');
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
    rechargeError.value = '单次充值至少 10 星能';
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
    toast(result.paid ? `${amount} 星能已到账` : result.message || '充值订单已创建');
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
    title: '星际公民认证',
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
    sub: '昵称每 30 天可修改一次',
  },
  {
    to: '/devices',
    icon: 'device',
    title: '星际终端',
    sub: `${data.value?.counts?.devices ?? 3} 台设备已绑定`,
  },
  {
    to: '/agreements',
    icon: 'file',
    title: '协议记录',
    sub: `${data.value?.counts?.agreementsSigned ?? 12} 份协议已签署`,
  },
]);
</script>

<template>
  <PageHeader
    :title="`欢迎回来，${user.name || '星际旅人'}`"
    sub="你的星际档案状态良好，今天也一起探索无限宇宙。"
  >
    <template #meta>
      <span class="badge badge-blue">{{ user.tierLabel || '星尘' }}会员</span>
      <span class="head-date">{{ data?.dateLabel || '正在校准星际时间…' }}</span>
    </template>
  </PageHeader>

  <div class="overview-grid">
    <article class="wallet-card">
      <svg class="wallet-deco" viewBox="0 0 240 240" fill="none" aria-hidden="true">
        <circle cx="190" cy="30" r="88" stroke="rgba(255,255,255,.14)" />
        <circle cx="190" cy="30" r="60" stroke="rgba(255,255,255,.18)" />
        <circle cx="190" cy="30" r="32" stroke="rgba(255,255,255,.1)" />
        <circle cx="128" cy="92" r="2.4" fill="rgba(255,255,255,.7)" />
        <circle cx="214" cy="118" r="1.8" fill="rgba(255,255,255,.5)" />
        <circle cx="152" cy="150" r="1.5" fill="rgba(255,255,255,.4)" />
      </svg>
      <div class="wallet-top">
        <span class="wallet-label">星际钱包 · 星能余额</span>
        <span class="wallet-chip"><AppIcon name="orbit" />INU PAY</span>
      </div>
      <div class="wallet-amount">{{ balance.integer }}<span>.{{ balance.decimal }}</span></div>
      <div class="wallet-foot">
        <span class="wallet-num">INU ···· {{ wallet.cardLast4 }}</span>
        <div class="wallet-actions">
          <button class="btn btn-sm btn-wallet" @click="openRecharge">充值</button>
          <RouterLink class="btn btn-sm btn-glass" to="/supply">明细</RouterLink>
        </div>
      </div>
    </article>

    <article class="stat-card">
      <div class="stat-top">
        <span class="stat-icon"><AppIcon name="spark" /></span>
        <span class="badge badge-green">+120 本周</span>
      </div>
      <div>
        <p class="stat-name">INU 粒子</p>
        <p class="stat-value">{{ number(particles) }}</p>
      </div>
      <p class="stat-foot">用于升级会员等级与兑换星际补给</p>
    </article>

    <article class="stat-card">
      <div class="stat-top">
        <span class="stat-icon"><AppIcon name="star" /></span>
        <span class="badge badge-blue">{{ user.tierEn || 'STARDUST' }}</span>
      </div>
      <div>
        <p class="stat-name">会员等级</p>
        <p class="stat-value">{{ user.tierLabel || '星尘' }}</p>
      </div>
      <div>
        <div class="progress"><span :style="{ width: `${progress}%` }" /></div>
        <p class="stat-foot">距离行星等级还需 {{ number(remaining) }} 粒子</p>
      </div>
    </article>
  </div>

  <div class="overview-row">
    <section class="card quick-card">
      <div class="card-head">
        <h2>快捷操作</h2>
        <span class="head-note">COMMAND DECK</span>
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
          <span class="inline-empty-icon"><AppIcon name="orbit" /></span>
          <h3>星际日志还很安静</h3>
          <p>完成一次认证或补给，新的坐标就会出现在这里。</p>
        </div>
      </div>
    </section>
  </div>

  <BaseModal v-model="rechargeOpen" title="星能充值" width="460px">
    <div class="modal-device">
      <span class="device-icon lg"><AppIcon name="spark" /></span>
      <div>
        <p class="modal-device-name">星际钱包 · INU PAY</p>
        <p class="modal-device-sub">当前余额 {{ balance.integer }}.{{ balance.decimal }} 星能</p>
      </div>
      <span class="badge badge-green">{{ paymentMode === 'mock' ? '演示支付' : '在线支付' }}</span>
    </div>

    <div class="field">
      <label>充值金额（星能）</label>
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
      <input v-model.number="rechargeAmount" class="input mono" type="number" min="10" max="50000" step="1" />
      <p class="hint">单次充值 10–50000 星能{{ paymentMode === 'mock' ? ' · 演示支付会即时到账' : '' }}</p>
    </div>

    <div class="field">
      <label>支付方式</label>
      <div class="method-row">
        <button
          v-for="item in [
            { key: 'inu_pay', label: 'INU PAY' },
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
      <button class="btn btn-ghost btn-sm" type="button" @click="rechargeOpen = false">取消</button>
      <button class="btn btn-primary btn-sm" type="button" :disabled="recharging" @click="submitRecharge">
        <span v-if="recharging" class="spinner" />
        {{ recharging ? '正在支付…' : `确认充值 ${rechargeAmount || 0} 星能` }}
      </button>
    </template>
  </BaseModal>

  <BaseModal v-model="activitiesOpen" title="全部星际动态" width="520px">
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
        <span class="inline-empty-icon"><AppIcon name="orbit" /></span>
        <h3>暂无更多动态</h3>
        <p>完成认证、签署协议或兑换补给后，记录会出现在这里。</p>
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.preset-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:10px}
.preset-btn{
  height:36px;border-radius:9px;border:1px solid var(--border-soft);background:var(--soft);
  color:var(--text-sub);font-size:12.5px;font-weight:600;cursor:pointer;transition:all .16s;
}
.preset-btn:hover{border-color:#C9D2E3;color:var(--text)}
.preset-btn.active{border-color:var(--primary);background:var(--primary-light);color:var(--primary)}
.method-row{display:flex;gap:8px;flex-wrap:wrap}
.method-btn{
  flex:1;min-width:96px;height:38px;border-radius:9px;border:1px solid var(--border-soft);
  background:var(--soft);color:var(--text-sub);font-size:12.5px;font-weight:500;cursor:pointer;transition:all .16s;
}
.method-btn.active{border-color:var(--primary);background:var(--primary-light);color:var(--primary);font-weight:600}
.feed-scroll{max-height:56vh;overflow-y:auto}
@media (max-width:520px){.preset-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
</style>
