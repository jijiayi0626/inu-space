<script setup>
import { computed, reactive, ref, watch } from 'vue';
import AppIcon from '../components/AppIcon.vue';
import BaseModal from '../components/BaseModal.vue';
import ContactVerifyModal from '../components/ContactVerifyModal.vue';
import PageHeader from '../components/PageHeader.vue';
import SkeletonBlock from '../components/SkeletonBlock.vue';
import { api } from '../lib/api';
import { timeLabel } from '../lib/format';
import { toast } from '../lib/toast';
import { useAsyncData } from '../lib/useAsyncData';

const { data, reload } = useAsyncData(({ force }) => api.get('/notifications', { force }));

const categories = ref([]);
const channels = ref([]);
const dirty = ref(false);
const savingTypes = ref(false);
const savingSettings = ref(false);
const channelSaving = ref({});

const settings = reactive({
  dndEnabled: false,
  dndStart: '22:00',
  dndEnd: '08:00',
  digestEnabled: true,
});

watch(
  data,
  (value) => {
    if (!value) return;
    categories.value = value.categories.map((item) => ({ ...item }));
    channels.value = value.channels.map((item) => ({ ...item }));
    Object.assign(settings, value.settings);
    dirty.value = false;
  },
  { immediate: true },
);

const channelCount = computed(() => channels.value.filter((item) => item.available && item.enabled).length);

function markDirty() {
  dirty.value = true;
}

function resetCategories() {
  if (!data.value) return;
  categories.value = data.value.categories.map((item) => ({ ...item }));
  dirty.value = false;
  toast('已还原本次通知设置');
}

async function saveCategories() {
  savingTypes.value = true;
  try {
    const prefs = Object.fromEntries(categories.value.map((item) => [item.key, item.enabled]));
    await api.patch('/notifications/prefs', { prefs });
    dirty.value = false;
    toast('通知类型已保存');
    await reload({ silent: true });
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    savingTypes.value = false;
  }
}

async function toggleChannel(channel, event) {
  const enabled = event.target.checked;
  channelSaving.value = { ...channelSaving.value, [channel.key]: true };
  try {
    await api.patch('/notifications/prefs', { prefs: { [channel.key]: enabled } });
    channel.enabled = enabled;
    if (channel.key !== 'channel_email') {
      channel.status = { label: enabled ? '已开启' : '已关闭', tone: enabled ? 'green' : 'gray' };
    }
    toast(`${channel.title}通知已${enabled ? '开启' : '关闭'}`);
    await reload({ silent: true });
  } catch (error) {
    event.target.checked = channel.enabled;
    toast(error.message, 'error');
  } finally {
    channelSaving.value = { ...channelSaving.value, [channel.key]: false };
  }
}

async function saveSettings() {
  savingSettings.value = true;
  try {
    await api.patch('/notifications/settings', {
      dndEnabled: settings.dndEnabled,
      dndStart: settings.dndStart,
      dndEnd: settings.dndEnd,
      digestEnabled: settings.digestEnabled,
    });
    toast('免打扰与摘要设置已保存');
    await reload({ silent: true });
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    savingSettings.value = false;
  }
}

async function toggleDigest(event) {
  const enabled = event.target.checked;
  settings.digestEnabled = enabled;
  try {
    await api.patch('/notifications/settings', { digestEnabled: enabled });
    toast(`每周邮件摘要已${enabled ? '开启' : '关闭'}`);
  } catch (error) {
    settings.digestEnabled = !enabled;
    event.target.checked = !enabled;
    toast(error.message, 'error');
  }
}

const inbox = computed(() => data.value?.messages || []);
const unread = computed(() => data.value?.unread || 0);

async function markRead(message) {
  if (message.read) return;
  try {
    await api.post(`/notifications/messages/${message.id}/read`);
    message.read = true;
    await reload({ silent: true });
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function readAll() {
  try {
    const result = await api.post('/notifications/messages/read-all');
    toast(result.updated ? `已将 ${result.updated} 条消息标为已读` : '没有未读消息');
    await reload({ silent: true });
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function removeMessage(message) {
  try {
    await api.del(`/notifications/messages/${message.id}`);
    toast('消息已删除');
    await reload({ silent: true });
  } catch (error) {
    toast(error.message, 'error');
  }
}

const messagesOpen = ref(false);
const allMessages = ref([]);
const messagesLoading = ref(false);

async function openAllMessages() {
  messagesOpen.value = true;
  messagesLoading.value = true;
  try {
    const result = await api.get('/notifications/messages?limit=100', { force: true, ttl: 0 });
    allMessages.value = result.messages || [];
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    messagesLoading.value = false;
  }
}

const phoneOpen = ref(false);

function openSms() {
  phoneOpen.value = true;
}

async function onPhoneUpdated() {
  await reload({ silent: true });
}
</script>

<template>
  <PageHeader title="通知偏好" sub="选择你想接收的星际讯息与送达渠道。">
    <template #meta>
      <span class="badge badge-blue">安全提醒已开启</span>
      <span class="head-date">{{ channelCount }} 个渠道在线</span>
    </template>
  </PageHeader>

  <section v-if="!data" class="card">
    <SkeletonBlock :rows="8" row-height="18px" />
  </section>

  <div v-else class="profile-grid">
    <div class="profile-main">
      <section id="inbox" class="card">
        <div class="card-head">
          <h2>站内信</h2>
          <span class="badge" :class="unread ? 'badge-orange' : 'badge-green'">{{ unread ? `${unread} 条未读` : '全部已读' }}</span>
          <div class="inbox-head-actions">
            <button class="btn btn-text" type="button" :disabled="!unread" @click="readAll">全部已读</button>
            <button class="btn btn-text" type="button" @click="openAllMessages">查看全部</button>
          </div>
        </div>
        <div class="inbox-list">
          <div v-for="message in inbox" :key="message.id" class="inbox-row" :class="{ unread: !message.read }">
            <span class="inbox-dot" />
            <div class="inbox-copy">
              <p class="inbox-title">{{ message.title }}</p>
              <p class="inbox-body">{{ message.body }}</p>
              <p class="inbox-meta">
                <span>{{ timeLabel(message.createdAt) }}</span>
                <RouterLink v-if="message.link" class="inbox-link" :to="message.link" @click="markRead(message)">查看详情</RouterLink>
              </p>
            </div>
            <div class="inbox-actions">
              <button v-if="!message.read" class="btn btn-text" type="button" @click="markRead(message)">标为已读</button>
              <button class="btn btn-text" type="button" @click="removeMessage(message)">删除</button>
            </div>
          </div>
          <div v-if="!inbox.length" class="inline-empty">
            <span class="inline-empty-icon"><AppIcon name="bell" /></span>
            <h3>收件箱还是空的</h3>
            <p>安全提醒、补给动态与星能变动会通过站内信送达。</p>
          </div>
        </div>
      </section>

      <section id="notify-types" class="card">
        <div class="card-head">
          <h2>通知类型</h2>
          <span class="head-note">{{ categories.length }} 类讯息</span>
        </div>
        <div class="notify-list">
          <label v-for="item in categories" :key="item.key" class="notify-row">
            <span class="notify-copy"><strong>{{ item.title }}</strong><em>{{ item.sub }}</em></span>
            <input v-model="item.enabled" type="checkbox" class="check" @change="markDirty" />
          </label>
        </div>
        <p class="notify-note"><AppIcon name="shield" />安全提醒建议保持开启</p>
        <div class="card-actions">
          <button class="btn btn-primary" type="button" :disabled="savingTypes || !dirty" @click="saveCategories">
            <span v-if="savingTypes" class="spinner" />
            {{ savingTypes ? '正在保存…' : '保存偏好' }}
          </button>
          <button class="btn btn-ghost" type="button" :disabled="savingTypes" @click="resetCategories">还原</button>
        </div>
      </section>

      <section id="notify-channels" class="card">
        <div class="card-head">
          <h2>通知渠道</h2>
          <span class="badge badge-green">{{ channelCount }} 个渠道可用</span>
        </div>
        <div class="channel-list">
          <div v-for="channel in channels" :key="channel.key" class="channel-row">
            <span class="sec-icon"><AppIcon :name="channel.icon" /></span>
            <span class="channel-copy">
              <span class="channel-title">{{ channel.title }}</span>
              <span class="channel-sub">{{ channel.sub }}</span>
            </span>
            <span class="badge" :class="`badge-${channel.status.tone}`">{{ channel.status.label }}</span>
            <label v-if="channel.available" class="switch" :aria-label="`${channel.title}通知`">
              <input
                type="checkbox"
                :checked="channel.enabled"
                :disabled="channelSaving[channel.key]"
                @change="toggleChannel(channel, $event)"
              />
              <span class="track" /><span class="thumb" />
            </label>
            <button
              v-else
              class="btn btn-text"
              type="button"
              @click="openSms"
            >
              去绑定
            </button>
          </div>
        </div>
        <p class="card-note">
          <AppIcon name="shield" />
          <span>账户安全类提醒不受免打扰时段影响，始终优先送达。</span>
        </p>
      </section>
    </div>

    <aside class="profile-side">
      <section id="dnd" class="card">
        <div class="card-head">
          <h2>免打扰时段</h2>
          <span class="badge" :class="settings.dndEnabled ? 'badge-green' : 'badge-gray'">
            {{ settings.dndEnabled ? '已开启' : '未开启' }}
          </span>
        </div>
        <p class="card-desc">在设定时段内静默非紧急通知，醒来后统一汇总。</p>
        <div class="sec-row">
          <div>
            <p class="sec-title">开启免打扰</p>
            <p class="sec-sub">安全提醒仍会正常送达</p>
          </div>
          <div class="sec-right">
            <label class="switch" aria-label="免打扰开关">
              <input v-model="settings.dndEnabled" type="checkbox" />
              <span class="track" /><span class="thumb" />
            </label>
          </div>
        </div>
        <div class="form-grid dnd-times">
          <div class="field">
            <label for="dndStart">开始时间</label>
            <input id="dndStart" v-model="settings.dndStart" class="input" type="time" lang="zh-CN" />
          </div>
          <div class="field">
            <label for="dndEnd">结束时间</label>
            <input id="dndEnd" v-model="settings.dndEnd" class="input" type="time" lang="zh-CN" />
          </div>
        </div>
        <div class="cta-stack">
          <button class="btn btn-ghost" type="button" :disabled="savingSettings" @click="saveSettings">
            <span v-if="savingSettings" class="spinner" />
            {{ savingSettings ? '正在保存…' : '保存时段' }}
          </button>
        </div>
      </section>

      <section id="digest" class="card">
        <div class="card-head">
          <h2>星际摘要</h2>
          <span class="badge badge-blue">每周一</span>
        </div>
        <div class="sec-row">
          <div>
            <p class="sec-title">每周邮件摘要</p>
            <p class="sec-sub">汇总粒子、权益与补给动态</p>
          </div>
          <div class="sec-right">
            <label class="switch" aria-label="每周邮件摘要">
              <input type="checkbox" :checked="settings.digestEnabled" @change="toggleDigest" />
              <span class="track" /><span class="thumb" />
            </label>
          </div>
        </div>
        <p class="quiet-text dnd-hint">摘要在每周一 09:00 发送至安全邮箱，可随时关闭。</p>
      </section>

      <section id="notify-tips" class="card">
        <div class="card-head">
          <h2>通知说明</h2>
        </div>
        <div class="tip-item"><AppIcon name="shield" /><span>安全类通知为保障账号所必需，无法完全关闭。</span></div>
        <div class="tip-item"><AppIcon name="mail" /><span>邮箱失效可能导致漏收重要协议，请及时更换。</span></div>
        <div class="tip-item"><AppIcon name="clock" /><span>免打扰期间的通知会在结束后按顺序补发。</span></div>
      </section>
    </aside>
  </div>

  <BaseModal v-model="messagesOpen" title="全部站内信" width="580px">
    <div v-if="messagesLoading" class="feed">
      <SkeletonBlock :rows="6" />
    </div>
    <div v-else class="inbox-list modal-inbox">
      <div v-for="message in allMessages" :key="message.id" class="inbox-row" :class="{ unread: !message.read }">
        <span class="inbox-dot" />
        <div class="inbox-copy">
          <p class="inbox-title">{{ message.title }}</p>
          <p class="inbox-body">{{ message.body }}</p>
          <p class="inbox-meta"><span>{{ timeLabel(message.createdAt) }}</span></p>
        </div>
      </div>
      <div v-if="!allMessages.length" class="inline-empty">
        <span class="inline-empty-icon"><AppIcon name="bell" /></span>
        <h3>暂无站内信</h3>
        <p>新的星际讯息会出现在这里。</p>
      </div>
    </div>
  </BaseModal>

  <ContactVerifyModal v-model="phoneOpen" kind="phone" @updated="onPhoneUpdated" />
</template>

<style scoped>
.inbox-head-actions{display:flex;gap:4px;margin-left:auto}
.inbox-list{display:flex;flex-direction:column;gap:2px}
.inbox-row{display:flex;align-items:flex-start;gap:10px;padding:12px 6px;border-bottom:1px solid var(--border-soft)}
.inbox-row:last-child{border-bottom:none}
.inbox-dot{width:8px;height:8px;border-radius:50%;background:var(--border-soft);margin-top:7px;flex:none}
.inbox-row.unread .inbox-dot{background:var(--primary);box-shadow:0 0 0 3px var(--primary-light)}
.inbox-copy{flex:1;min-width:0}
.inbox-title{font-size:12.5px;font-weight:600}
.inbox-row.unread .inbox-title{color:var(--primary)}
.inbox-body{font-size:11.5px;line-height:1.65;color:var(--text-sub);margin-top:2px}
.inbox-meta{display:flex;align-items:center;gap:10px;font-size:11px;color:var(--text-mute);margin-top:5px}
.inbox-link{color:var(--primary);font-weight:500}
.inbox-actions{display:flex;flex-direction:column;gap:2px;flex:none}
.modal-inbox{max-height:60vh;overflow-y:auto}
</style>
