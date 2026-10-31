<script setup>
import { computed } from 'vue';
import AppIcon from '../components/AppIcon.vue';
import PageHeader from '../components/PageHeader.vue';
import SkeletonBlock from '../components/SkeletonBlock.vue';
import { api } from '../lib/api';
import { number, moneyParts, timeLabel } from '../lib/format';
import { session } from '../lib/session';
import { toast } from '../lib/toast';
import { useAsyncData } from '../lib/useAsyncData';

const { data, loading } = useAsyncData(({ force }) => api.get('/overview', { force }));

const user = computed(() => data.value?.user || session.user || {});
const wallet = computed(() => data.value?.wallet || { balanceCents: user.value.starEnergyCents || 0, cardLast4: '0721' });
const balance = computed(() => moneyParts(wallet.value.balanceCents));
const particles = computed(() => user.value.particles || 0);
const progress = computed(() => Math.min(99, Math.floor((particles.value / 10000) * 100)));
const remaining = computed(() => Math.max(0, 10000 - particles.value));

const quicks = computed(() => [
  {
    to: '/profile#verify',
    icon: 'idcard',
    title: '星际公民认证',
    sub: user.value.verified ? '已认证 · 权限已解锁' : '未实名 · 立即认证',
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
          <button class="btn btn-sm btn-wallet" @click="toast('充值通道正在接入星际网络，敬请期待')">充值</button>
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
        <button class="btn btn-text" @click="toast('已展示最近 30 天的全部动态')">查看全部</button>
      </div>

      <div v-if="!data && loading" class="feed">
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
</template>
