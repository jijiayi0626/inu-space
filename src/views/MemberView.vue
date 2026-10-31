<script setup>
import { computed } from 'vue';
import AppIcon from '../components/AppIcon.vue';
import PageHeader from '../components/PageHeader.vue';
import SkeletonBlock from '../components/SkeletonBlock.vue';
import { api } from '../lib/api';
import { dateTimeLabel, number } from '../lib/format';
import { toast } from '../lib/toast';
import { useAsyncData } from '../lib/useAsyncData';

const { data } = useAsyncData(({ force }) => api.get('/member', { force }));

const tier = computed(() => data.value?.tier || {});
const next = computed(() => data.value?.next || null);
const progress = computed(() => data.value?.progress || 0);

function scrollToBenefits() {
  document.getElementById('benefits')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
</script>

<template>
  <PageHeader title="会员中心" sub="星尘、行星、恒星与星系，四段旅程组成你的星际轨迹。">
    <template #meta>
      <span class="badge badge-blue">{{ tier.label || '星尘' }}会员</span>
      <span class="head-date">有效期至 {{ tier.validUntil || '2027-10-10' }}</span>
    </template>
  </PageHeader>

  <section v-if="!data" class="card">
    <SkeletonBlock :rows="8" row-height="18px" />
  </section>

  <div v-else class="stack">
    <section class="member-hero">
      <div class="hero-copy">
        <p class="hero-label">当前会员等级</p>
        <p class="hero-level">{{ tier.label }} <small>{{ tier.en }}</small></p>
        <p class="hero-desc">{{ tier.desc }}</p>
        <div class="hero-actions">
          <button class="btn btn-sm btn-wallet" type="button" @click="scrollToBenefits">查看权益</button>
          <RouterLink class="btn btn-sm btn-glass" to="/supply">星能补给</RouterLink>
        </div>
      </div>
      <div class="hero-progress">
        <div class="hero-progress-head">
          <span>{{ next ? `距离${next.label}等级` : '已抵达最高等级' }}</span>
          <span>{{ progress }}%</span>
        </div>
        <div class="hero-track"><span :style="{ width: `${progress}%` }" /></div>
        <p class="hero-desc">
          <template v-if="next">
            还需 {{ number(data.remaining) }} INU 粒子 · 预计 {{ data.estimatedDays }} 天后达成
          </template>
          <template v-else>你已成为一片星系的引力中心，新的旅程仍在继续。</template>
        </p>
      </div>
    </section>

    <section id="benefits" class="card">
      <div class="card-head">
        <h2>{{ tier.label }}权益</h2>
        <span class="head-note">{{ tier.en }} BENEFITS</span>
      </div>
      <div class="benefit-grid">
        <article v-for="benefit in data.benefits" :key="benefit.key" class="benefit-card">
          <span class="benefit-icon"><AppIcon :name="benefit.icon" /></span>
          <p class="benefit-title">{{ benefit.title }}</p>
          <p class="benefit-desc">{{ benefit.desc }}</p>
          <span class="badge benefit-badge" :class="benefit.unlocked ? 'badge-green' : 'badge-gray'">
            {{ benefit.unlocked ? '已解锁' : '待解锁' }}
          </span>
        </article>
      </div>
    </section>

    <section id="levels" class="card">
      <div class="card-head">
        <h2>等级体系</h2>
        <button class="btn btn-text" @click="toast('等级规则正在同步至星际终端')">了解规则</button>
      </div>
      <div class="tier-grid">
        <article
          v-for="item in data.tiers"
          :key="item.key"
          class="tier-card"
          :class="{ current: item.current }"
        >
          <p class="tier-name"><AppIcon :name="item.icon" />{{ item.label }}</p>
          <p class="tier-meta"><b>{{ number(item.min) }}</b> 粒子起 · {{ item.discount }}补给</p>
          <span class="badge" :class="item.current ? 'badge-blue' : item.unlocked ? 'badge-green' : 'badge-gray'">
            {{ item.current ? '当前' : item.unlocked ? '已解锁' : '未解锁' }}
          </span>
        </article>
      </div>
    </section>

    <section id="particles" class="card">
      <div class="card-head">
        <h2>粒子记录</h2>
        <button class="btn btn-text" @click="toast('已展示最近 30 天的全部粒子记录')">查看全部</button>
      </div>
      <div class="table-wrap">
        <table class="data-table responsive particles">
          <thead>
            <tr><th>时间</th><th>事项</th><th>变动</th><th>余额</th></tr>
          </thead>
          <tbody>
            <tr v-for="log in data.particleLogs" :key="log.id">
              <td class="num">{{ dateTimeLabel(log.occurredAt) }}</td>
              <td>{{ log.label }}</td>
              <td>
                <span class="badge" :class="log.delta >= 0 ? 'badge-green' : 'badge-red'">
                  {{ log.delta >= 0 ? '+' : '' }}{{ number(log.delta) }}
                </span>
              </td>
              <td class="num">{{ number(log.balance) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="card-note">
        <AppIcon name="clock" />
        <span>INU 粒子有效期为 12 个月，过期后将按 100:1 自动折算为星能。</span>
      </p>
    </section>
  </div>
</template>
