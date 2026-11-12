<script setup>
import { computed, ref } from 'vue';
import { Button, Checkbox } from 'fuxsto-design-pro';
import AppIcon from '../components/AppIcon.vue';
import BaseModal from '../components/BaseModal.vue';
import PageHeader from '../components/PageHeader.vue';
import SkeletonBlock from '../components/SkeletonBlock.vue';
import { api } from '../lib/api';
import { dateLabel, dateTimeLabel } from '../lib/format';
import { session } from '../lib/session';
import { toast } from '../lib/toast';
import { useAsyncData } from '../lib/useAsyncData';

const { data, reload } = useAsyncData(({ force }) => api.get('/agreements', { force }));

const stats = computed(() => data.value?.stats || { signed: 0, pending: 0, total: 0, lastSigned: null });
const agreementsEnabled = computed(() => session.site?.features?.agreements !== false);

const signOpen = ref(false);
const selected = ref(null);
const agreed = ref(false);
const signing = ref(false);

const contentOpen = ref(false);
const contentItem = ref(null);
const contentText = ref('');
const contentLoading = ref(false);

function openSign(item) {
  if (!agreementsEnabled.value) {
    toast('协议签署功能暂未开放', 'error');
    return;
  }
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
    toast(`《${result.item.title}》已签署，+${result.reward} 积分`);
    await reload({ silent: true });
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    signing.value = false;
  }
}

async function viewAgreement(item) {
  contentItem.value = item;
  contentText.value = '';
  contentOpen.value = true;
  contentLoading.value = true;
  try {
    const result = await api.get(`/agreements/${item.id}`, { force: true, ttl: 0 });
    contentText.value = result.item?.content || '协议正文加载中，请稍后再试。';
  } catch (error) {
    contentText.value = '';
    toast(error.message, 'error');
  } finally {
    contentLoading.value = false;
  }
}

function exportAgreement(item) {
  const link = document.createElement('a');
  link.href = `/api/agreements/${item.id}/export`;
  link.download = `${item.title}-${item.version}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
</script>

<template>
  <PageHeader title="协议中心" sub="查阅协议、签署记录与待办协议。">
    <template #meta>
      <span class="badge" :class="stats.pending ? 'badge-orange' : 'badge-green'">
        {{ stats.pending ? `${stats.pending} 份待签署` : '全部已签署' }}
      </span>
      <span class="head-date">共 {{ stats.total }} 份</span>
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
        </div>
        <div>
          <p class="stat-name">已签署协议</p>
          <p class="stat-value">{{ stats.signed }}<small>份</small></p>
        </div>
        <p class="stat-foot">签署后会自动归档并支持导出</p>
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
        <p class="stat-foot">完成签署可获得协议对应的积分奖励</p>
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
        <span class="head-note">共 {{ stats.total }} 份</span>
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
                <button v-else class="btn btn-text" type="button" @click="viewAgreement(item)">预览</button>
                <button v-if="item.status === 'signed'" class="btn btn-text" type="button" @click="exportAgreement(item)">
                  导出
                </button>
                <button v-else class="btn btn-text" type="button" :disabled="!item.active" @click="openSign(item)">
                  {{ item.active ? '签署' : '已下架' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="card-note">
        <AppIcon name="shield" />
        <span>协议签署记录具有协议效力，可在需要时导出 Markdown 存档。</span>
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
        签署后即表示你已阅读并同意该协议的全部条款，签署记录会保存到你的协议记录。
      </p>
      <div class="agree-row" @click="agreed = !agreed">
        <span class="agree-check" @click.stop>
          <Checkbox v-model="agreed" :aria-label="`同意《${selected.title}》`" />
        </span>
        <span>我已阅读并同意《{{ selected.title }}》的全部内容</span>
      </div>
      <p class="card-note">
        <AppIcon name="info" />
        <span>完成签署将获得 {{ selected.reward || 50 }} 积分，并计入你的账户记录。</span>
      </p>
    </template>
    <template #footer>
      <Button variant="secondary" size="sm" type="button" @click="signOpen = false">取消</Button>
      <Button variant="primary" size="sm" type="button" :disabled="signing" @click="confirmSign">
        <span v-if="signing" class="spinner" />
        {{ signing ? '正在签署…' : '确认签署' }}
      </Button>
    </template>
  </BaseModal>

  <BaseModal v-model="contentOpen" :title="contentItem ? `《${contentItem.title}》` : '协议正文'" width="620px">
    <div class="agreement-meta">
      <span class="badge badge-blue">{{ contentItem?.version || '—' }}</span>
      <span class="badge" :class="contentItem?.status === 'signed' ? 'badge-green' : 'badge-orange'">
        {{ contentItem?.status === 'signed' ? '已签署' : '待签署' }}
      </span>
      <span v-if="contentItem?.signedAt" class="head-note">签署于 {{ dateTimeLabel(contentItem.signedAt) }}</span>
    </div>
    <div v-if="contentLoading" class="feed">
      <SkeletonBlock :rows="7" />
    </div>
    <div v-else class="agreement-content">{{ contentText }}</div>
    <template #footer>
      <Button variant="secondary" size="sm" type="button" @click="contentOpen = false">关闭</Button>
      <Button variant="secondary" size="sm" v-if="contentItem" type="button" @click="exportAgreement(contentItem)">
        <AppIcon name="file" />
        导出 Markdown
      </Button>
    </template>
  </BaseModal>
</template>

<style scoped>
.agreement-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.agreement-content{
  max-height:56vh;overflow-y:auto;white-space:pre-wrap;line-height:1.9;
  font-size:13px;color:var(--text-sub);padding:2px 2px 8px;
}
</style>
