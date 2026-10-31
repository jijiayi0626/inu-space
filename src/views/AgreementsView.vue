<script setup>
import { computed, ref } from 'vue';
import AppIcon from '../components/AppIcon.vue';
import BaseModal from '../components/BaseModal.vue';
import PageHeader from '../components/PageHeader.vue';
import SkeletonBlock from '../components/SkeletonBlock.vue';
import { api } from '../lib/api';
import { dateLabel, dateTimeLabel } from '../lib/format';
import { toast } from '../lib/toast';
import { useAsyncData } from '../lib/useAsyncData';

const { data, reload } = useAsyncData(({ force }) => api.get('/agreements', { force }));

const stats = computed(() => data.value?.stats || { signed: 0, pending: 0, total: 0, lastSigned: null });

const signOpen = ref(false);
const selected = ref(null);
const agreed = ref(false);
const signing = ref(false);

function openSign(item) {
  selected.value = item;
  agreed.value = false;
  signOpen.value = true;
}

async function confirmSign() {
  if (!agreed.value) {
    toast('请先勾选同意协议内容', 'error');
    return;
  }
  signing.value = true;
  try {
    const result = await api.post(`/agreements/${selected.value.id}/sign`);
    signOpen.value = false;
    toast(`《${result.item.title}》已签署，+${result.reward} INU 粒子`);
    await reload({ silent: true });
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    signing.value = false;
  }
}

function viewAgreement(item) {
  toast(`《${item.title}》正文正在同步至星际终端`);
}
</script>

<template>
  <PageHeader title="协议中心" sub="查阅星际法条、签署记录与待办协议。">
    <template #meta>
      <span class="badge" :class="stats.pending ? 'badge-orange' : 'badge-green'">
        {{ stats.pending ? `${stats.pending} 份待签署` : '全部已签署' }}
      </span>
      <span class="head-date">共 {{ stats.total }} 份 · STARFLEET LEGAL</span>
    </template>
  </PageHeader>

  <section v-if="!data" class="card">
    <SkeletonBlock :rows="8" row-height="18px" />
  </section>

  <template v-else>
    <div class="overview-grid">
      <article class="stat-card">
        <div class="stat-top">
          <span class="stat-icon"><AppIcon name="file" /></span>
          <span class="badge badge-green">+2 本月</span>
        </div>
        <div>
          <p class="stat-name">已签署协议</p>
          <p class="stat-value">{{ stats.signed }}<small>份</small></p>
        </div>
        <p class="stat-foot">全部协议均已完成星际法条归档</p>
      </article>
      <article class="stat-card">
        <div class="stat-top">
          <span class="stat-icon"><AppIcon name="clock" /></span>
          <span class="badge" :class="stats.pending ? 'badge-orange' : 'badge-green'">需处理</span>
        </div>
        <div>
          <p class="stat-name">待签署</p>
          <p class="stat-value">{{ stats.pending }}<small>份</small></p>
        </div>
        <p class="stat-foot">完成签署可获得 50 INU 粒子 / 份</p>
      </article>
      <article class="stat-card">
        <div class="stat-top">
          <span class="stat-icon"><AppIcon name="pen" /></span>
          <span class="badge badge-blue">{{ stats.lastSigned?.version || '—' }}</span>
        </div>
        <div>
          <p class="stat-name">最近签署</p>
          <p class="stat-value">{{ stats.lastSigned ? dateLabel(stats.lastSigned.signedAt).slice(5) : '—' }}</p>
        </div>
        <p class="stat-foot">{{ stats.lastSigned ? `《${stats.lastSigned.title}》` : '暂无签署记录' }}</p>
      </article>
    </div>

    <section id="agreement-list" class="card">
      <div class="card-head">
        <h2>全部协议</h2>
        <span class="head-note">共 {{ stats.total }} 份 · STARFLEET LEGAL</span>
      </div>
      <div class="table-wrap">
        <table class="data-table responsive agreements">
          <thead>
            <tr><th>协议名称</th><th>版本</th><th>状态</th><th>签署时间</th><th class="actions">操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="item in data.items" :key="item.id">
              <td class="strong">{{ item.title }}</td>
              <td class="num">{{ item.version }}</td>
              <td>
                <span class="badge" :class="item.status === 'signed' ? 'badge-green' : 'badge-orange'">
                  {{ item.status === 'signed' ? '已签署' : '待签署' }}
                </span>
              </td>
              <td class="num">{{ item.signedAt ? dateTimeLabel(item.signedAt) : '—' }}</td>
              <td class="actions">
                <button v-if="item.status === 'signed'" class="btn btn-text" type="button" @click="viewAgreement(item)">
                  查看
                </button>
                <button v-else class="btn btn-text" type="button" @click="openSign(item)">签署</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="card-note">
        <AppIcon name="shield" />
        <span>协议签署记录具有星际法条效力，可在需要时导出 PDF 存档。</span>
      </p>
    </section>
  </template>

  <BaseModal v-model="signOpen" title="签署协议" width="470px">
    <template v-if="selected">
      <div class="modal-device">
        <span class="device-icon lg"><AppIcon name="file" /></span>
        <div>
          <p class="modal-device-name">《{{ selected.title }}》</p>
          <p class="modal-device-sub">版本 {{ selected.version }} · 生效中</p>
        </div>
      </div>
      <p class="quiet-text">
        签署后即表示你已阅读并同意该协议的全部条款，签署记录将写入星际法条库。
      </p>
      <label class="agree-row">
        <input v-model="agreed" type="checkbox" class="check" />
        <span>我已阅读并同意《{{ selected.title }}》的全部内容</span>
      </label>
      <p class="card-note">
        <AppIcon name="spark" />
        <span>完成签署将获得 50 INU 粒子，并同步更新你的星际信用档案。</span>
      </p>
    </template>
    <template #footer>
      <button class="btn btn-ghost btn-sm" type="button" @click="signOpen = false">取消</button>
      <button class="btn btn-primary btn-sm" type="button" :disabled="signing" @click="confirmSign">
        <span v-if="signing" class="spinner" />
        {{ signing ? '正在归档…' : '确认签署' }}
      </button>
    </template>
  </BaseModal>
</template>
