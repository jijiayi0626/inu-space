<script setup>
import { computed, ref } from 'vue';
import { Button } from 'fuxsto-design-pro';
import AppIcon from '../components/AppIcon.vue';
import BaseModal from '../components/BaseModal.vue';
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

const rulesOpen = ref(false);
const particlesOpen = ref(false);
const particleLogs = ref([]);
const particlesLoading = ref(false);

function scrollToBenefits() {
  document.getElementById('benefits')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function openAllParticles() {
  particlesOpen.value = true;
  particlesLoading.value = true;
  try {
    const result = await api.get('/member/particles?limit=200', { force: true, ttl: 0 });
    particleLogs.value = result.logs || [];
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    particlesLoading.value = false;
  }
}
</script>

<template>
  <PageHeader title="会员中心" sub="等级、折扣与积分权益，都在这里。">
    <template #meta>
      <span class="badge badge-blue">{{ tier.label || '普通' }}会员</span>
      <span class="head-date">{{ tier.validUntil ? `有效期至 ${tier.validUntil}` : '长期有效' }}</span>
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
          <Button variant="secondary" size="sm" class="btn-wallet" type="button" @click="scrollToBenefits">查看权益</Button>
          <RouterLink class="btn btn-sm btn-glass" to="/supply">积分商品</RouterLink>
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
            还需 {{ number(data.remaining) }} 积分<template v-if="data.estimatedDays"> · 预计 {{ data.estimatedDays }} 天后达成</template>
          </template>
          <template v-else>已达到最高等级，感谢你的长期支持。</template>
        </p>
      </div>
    </section>

    <section id="benefits" class="card">
      <div class="card-head">
        <h2>{{ tier.label }}权益</h2>
        <span class="head-note">当前等级</span>
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
        <button class="btn btn-text" @click="rulesOpen = true">了解规则</button>
      </div>
      <div class="tier-grid">
        <article
          v-for="item in data.tiers"
          :key="item.key"
          class="tier-card"
          :class="{ current: item.current }"
        >
          <p class="tier-name"><AppIcon :name="item.icon" />{{ item.label }}</p>
          <p class="tier-meta"><b>{{ number(item.min) }}</b> 积分起 · {{ item.discount }}会员价</p>
          <span class="badge" :class="item.current ? 'badge-blue' : item.unlocked ? 'badge-green' : 'badge-gray'">
            {{ item.current ? '当前' : item.unlocked ? '已解锁' : '未解锁' }}
          </span>
        </article>
      </div>
    </section>

    <section id="particles" class="card">
      <div class="card-head">
        <h2>积分记录</h2>
        <button class="btn btn-text" @click="openAllParticles">查看全部</button>
      </div>
      <div class="table-wrap">
        <table class="data-table responsive particles">
          <thead>
            <tr><th>时间</th><th>事项</th><th>变动</th><th>结余</th></tr>
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
        <AppIcon name="star" />
        <span>积分与余额相互独立，积分可升级等级、兑换商品，也可在积分商城用余额按比例兑换。</span>
      </p>
    </section>
  </div>

  <BaseModal v-model="rulesOpen" title="会员规则" width="500px">
    <div class="rule-list">
      <div v-for="rule in data?.rules || []" :key="rule.title" class="rule-row">
        <span class="rule-mark"><AppIcon name="info" /></span>
        <div>
          <p class="rule-title">{{ rule.title }}</p>
          <p class="rule-text">{{ rule.text }}</p>
        </div>
      </div>
    </div>
  </BaseModal>

  <BaseModal v-model="particlesOpen" title="全部积分记录" width="620px">
    <div v-if="particlesLoading" class="feed">
      <SkeletonBlock :rows="6" />
    </div>
    <div v-else class="table-wrap modal-table">
      <table class="data-table responsive particles">
        <thead>
          <tr><th>时间</th><th>事项</th><th>变动</th><th>结余</th></tr>
        </thead>
        <tbody>
          <tr v-for="log in particleLogs" :key="log.id">
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
      <div v-if="!particleLogs.length" class="inline-empty">
        <span class="inline-empty-icon"><AppIcon name="info" /></span>
        <h3>暂无积分记录</h3>
        <p>签署协议或兑换商品后，积分变动会记录在这里。</p>
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.rule-list{display:flex;flex-direction:column;gap:14px;padding-bottom:6px}
.rule-row{display:flex;gap:11px;align-items:flex-start}
.rule-mark{
  width:32px;height:32px;border-radius:9px;display:grid;place-items:center;flex:none;
  color:var(--primary);background:var(--primary-light);
}
.rule-mark .icon{width:16px;height:16px}
.rule-title{font-size:13px;font-weight:700;margin-bottom:3px}
.rule-text{font-size:12px;line-height:1.7;color:var(--text-sub)}
.modal-table{max-height:58vh;overflow:auto}
</style>
