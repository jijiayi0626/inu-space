<script setup>
import { computed, reactive, ref } from 'vue';
import AppIcon from '../components/AppIcon.vue';
import BaseModal from '../components/BaseModal.vue';
import PageHeader from '../components/PageHeader.vue';
import SkeletonBlock from '../components/SkeletonBlock.vue';
import { api } from '../lib/api';
import { timeLabel } from '../lib/format';
import { toast } from '../lib/toast';
import { useAsyncData } from '../lib/useAsyncData';

const { data, reload } = useAsyncData(({ force }) => api.get('/devices', { force }));

const devices = computed(() => data.value?.devices || []);
const sessions = computed(() => data.value?.sessions || []);
const currentSession = computed(() => sessions.value.find((item) => item.current) || null);
const current = computed(
  () => currentSession.value || data.value?.current || devices.value.find((item) => item.current) || null,
);
const currentMeta = computed(() => {
  const value = current.value || {};
  return {
    ...value,
    lastActiveAt: value.lastActiveAt || value.createdAt || '',
    method: value.method || '账号会话',
  };
});

const detailOpen = ref(false);
const selected = ref(null);

const confirmOpen = ref(false);
const confirmType = ref('unbind');
const confirmTarget = ref(null);
const confirmLoading = ref(false);

const confirmTitle = computed(() => {
  if (confirmType.value === 'logout') return '退出其余登录设备';
  if (confirmType.value === 'session') return '退出该登录会话';
  return '解绑登录设备';
});

function iconFor(kind) {
  return kind === 'phone' ? 'phone' : kind === 'tablet' ? 'tablet' : 'laptop';
}

function openDetail(device) {
  selected.value = device;
  detailOpen.value = true;
}

function askUnbind(device) {
  confirmType.value = 'unbind';
  confirmTarget.value = device;
  confirmOpen.value = true;
}

function askRevokeSession(item) {
  confirmType.value = 'session';
  confirmTarget.value = item;
  confirmOpen.value = true;
}

function askLogoutOthers() {
  confirmType.value = 'logout';
  confirmTarget.value = null;
  confirmOpen.value = true;
}

async function confirmAction() {
  confirmLoading.value = true;
  try {
    if (confirmType.value === 'unbind') {
      await api.post(`/devices/${confirmTarget.value.id}/unbind`);
      toast('已发送解绑请求，该设备已退出服务');
    } else if (confirmType.value === 'session') {
      const result = await api.post(`/devices/sessions/${confirmTarget.value.id}/revoke`);
      toast(result.message || '该会话已退出');
    } else {
      const result = await api.post('/devices/logout-others');
      toast(result.removed ? `已退出其余 ${result.removed} 个设备` : '当前没有其它在线设备');
    }
    confirmOpen.value = false;
    detailOpen.value = false;
    await reload({ silent: true });
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    confirmLoading.value = false;
  }
}

const addOpen = ref(false);
const addSaving = ref(false);
const addError = ref('');
const addForm = reactive({ name: '', kind: 'laptop', os: '' });

function openAdd() {
  addForm.name = '';
  addForm.kind = 'laptop';
  addForm.os = '';
  addError.value = '';
  addOpen.value = true;
}

async function submitAdd() {
  addError.value = '';
  const name = addForm.name.trim();
  if ([...name].length < 2 || [...name].length > 24) {
    addError.value = '设备名称需为 2–24 个字符';
    return;
  }
  addSaving.value = true;
  try {
    await api.post('/devices', { name, kind: addForm.kind, os: addForm.os.trim() });
    addOpen.value = false;
    toast('新设备已加入可信列表');
    await reload({ silent: true });
  } catch (error) {
    addError.value = error.message;
  } finally {
    addSaving.value = false;
  }
}

const logsOpen = ref(false);
const allLogs = ref([]);
const logsLoading = ref(false);

const renameOpen = ref(false);
const renameTarget = ref(null);
const renameValue = ref('');
const renameSaving = ref(false);
const renameError = ref('');

function openRename(item) {
  renameTarget.value = item;
  renameValue.value = item.customName ? item.name : '';
  renameError.value = '';
  renameOpen.value = true;
}

async function submitRename() {
  if (!renameTarget.value) return;
  renameSaving.value = true;
  renameError.value = '';
  try {
    await api.patch(`/devices/sessions/${renameTarget.value.id}/name`, { name: renameValue.value.trim() });
    renameOpen.value = false;
    toast('会话名称已更新');
    await reload({ silent: true });
  } catch (error) {
    renameError.value = error.message;
  } finally {
    renameSaving.value = false;
  }
}

async function openAllLogs() {
  logsOpen.value = true;
  logsLoading.value = true;
  try {
    const result = await api.get('/devices/logs?limit=100', { force: true, ttl: 0 });
    allLogs.value = result.logs || [];
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    logsLoading.value = false;
  }
}
</script>

<template>
  <PageHeader title="登录设备" sub="查看已绑定设备、登录记录并管理设备权限。">
    <template #meta>
      <span class="badge badge-blue">{{ devices.length }} 台已绑定</span>
      <span class="head-date">当前设备 · {{ current?.name || '读取中' }}</span>
    </template>
  </PageHeader>

  <section v-if="!data" class="card">
    <SkeletonBlock :rows="8" row-height="18px" />
  </section>

  <div v-else class="profile-grid">
    <div class="profile-main">
      <section id="device-list" class="card">
        <div class="card-head">
          <h2>已绑定设备</h2>
          <button class="btn btn-ghost btn-sm" @click="openAdd">添加设备</button>
        </div>

        <div class="device-list">
          <div v-for="device in devices" :key="device.id" class="device-row">
            <span class="device-icon"><AppIcon :name="iconFor(device.kind)" /></span>
            <div class="device-info">
              <p class="device-name">
                {{ device.name }}
                <span v-if="device.current" class="badge badge-green">当前设备</span>
                <span v-else-if="device.stale" class="badge badge-gray">30 天未活跃</span>
                <span v-else-if="device.trusted" class="badge badge-blue">可信</span>
              </p>
              <p class="device-meta">
                {{ device.os }} · {{ device.location }} · 最近活跃 {{ timeLabel(device.lastActiveAt) }}
              </p>
            </div>
            <div class="device-actions">
              <button class="btn btn-ghost btn-sm" @click="openDetail(device)">详情</button>
              <button v-if="!device.current" class="btn btn-danger btn-sm" @click="askUnbind(device)">解绑</button>
            </div>
          </div>

          <div v-if="!devices.length" class="inline-empty">
            <span class="inline-empty-icon"><AppIcon name="device" /></span>
            <h3>还没有可信设备</h3>
            <p>添加一台设备，让常用设备更容易被识别。</p>
          </div>
        </div>
      </section>

      <section id="login-history" class="card">
        <div class="card-head">
          <h2>登录记录</h2>
          <button class="btn btn-text" @click="openAllLogs">查看全部</button>
        </div>
        <div class="feed">
          <div v-for="log in data.logs" :key="log.id" class="feed-item">
            <span class="feed-chip" :class="`chip-${log.tone}`"><AppIcon :name="log.icon" /></span>
            <div class="feed-body">
              <p class="feed-title">{{ log.event }}</p>
              <p class="feed-sub">{{ log.detail }}</p>
            </div>
            <span class="feed-time">{{ timeLabel(log.occurredAt) }}</span>
          </div>
        </div>
      </section>

      <section id="active-sessions" class="card">
        <div class="card-head">
          <h2>活跃会话</h2>
          <span class="badge" :class="sessions.length ? 'badge-blue' : 'badge-gray'">
            {{ sessions.length }} 个在线
          </span>
        </div>
        <p class="card-desc">这里展示当前账号在所有浏览器和设备上的登录会话，可按会话单独退出。</p>
        <div class="device-list">
          <div v-for="item in sessions" :key="item.id" class="device-row">
            <span class="device-icon"><AppIcon :name="iconFor(item.kind)" /></span>
            <div class="device-info">
              <p class="device-name">
                {{ item.name }}
                <span v-if="item.current" class="badge badge-green">当前会话</span>
              </p>
              <p class="device-meta">
                {{ item.browser }} · {{ item.os }} · {{ item.location || '未知位置' }}
              </p>
              <p class="device-meta">{{ item.ip }} · 登录于 {{ timeLabel(item.createdAt) }}</p>
            </div>
            <div class="device-actions">
              <button class="btn btn-text btn-sm" type="button" @click="openRename(item)">重命名</button>
              <button
                v-if="!item.current"
                class="btn btn-danger btn-sm"
                type="button"
                @click="askRevokeSession(item)"
              >
                退出会话
              </button>
            </div>
          </div>

          <div v-if="!sessions.length" class="inline-empty">
            <span class="inline-empty-icon"><AppIcon name="device" /></span>
            <h3>暂无活跃会话</h3>
            <p>新的浏览器或设备登录后，会在这里显示解析后的系统、浏览器与登录位置。</p>
          </div>
        </div>
      </section>
    </div>

    <aside class="profile-side">
      <section id="current-session" class="card">
        <div class="card-head">
          <h2>当前会话</h2>
          <span class="badge badge-green">在线</span>
        </div>
        <div class="modal-device">
          <span class="device-icon lg"><AppIcon :name="iconFor(currentMeta.kind)" /></span>
          <div>
            <p class="modal-device-name">{{ currentMeta.name || '登录设备' }}</p>
            <p class="modal-device-sub">已通过安全验证</p>
          </div>
        </div>
        <dl class="detail-list">
          <div class="detail-row"><dt>系统版本</dt><dd>{{ currentMeta.os || '—' }}</dd></div>
          <div class="detail-row"><dt>IP 地址</dt><dd>{{ currentMeta.ip || '—' }}</dd></div>
          <div class="detail-row"><dt>登录位置</dt><dd>{{ currentMeta.location || '—' }}</dd></div>
          <div class="detail-row"><dt>最近活跃</dt><dd>{{ timeLabel(currentMeta.lastActiveAt) }}</dd></div>
          <div class="detail-row"><dt>登录方式</dt><dd>{{ currentMeta.method || '密码登录' }}</dd></div>
        </dl>
        <div class="cta-stack">
          <button class="btn btn-danger" type="button" @click="askLogoutOthers">退出其他设备</button>
        </div>
      </section>

      <section id="device-tips" class="card">
        <div class="card-head">
          <h2>设备安全提示</h2>
        </div>
        <div class="tip-item"><AppIcon name="shield" /><span>只在你信任的设备上保持登录状态。</span></div>
        <div class="tip-item"><AppIcon name="device" /><span>发现陌生设备时，立即解绑并修改密码。</span></div>
        <div class="tip-item"><AppIcon name="bell" /><span>开启新设备验证，登录时会收到提醒。</span></div>
        <p class="card-note">
          <AppIcon name="info" />
          <span>30 天未活跃的设备会被自动标记，建议定期清理。</span>
        </p>
      </section>
    </aside>
  </div>

  <BaseModal v-model="detailOpen" title="登录设备详情">
    <template v-if="selected">
      <div class="modal-device">
        <span class="device-icon lg"><AppIcon :name="iconFor(selected.kind)" /></span>
        <div>
          <p class="modal-device-name">{{ selected.name }}</p>
          <p class="modal-device-sub">已通过安全验证</p>
        </div>
        <span class="badge" :class="selected.trusted ? 'badge-green' : 'badge-gray'">
          {{ selected.trusted ? '可信设备' : '待验证' }}
        </span>
      </div>
      <dl class="detail-list">
        <div class="detail-row"><dt>系统版本</dt><dd>{{ selected.os }}</dd></div>
        <div class="detail-row"><dt>IP 地址</dt><dd>{{ selected.ip }}</dd></div>
        <div class="detail-row"><dt>登录位置</dt><dd>{{ selected.location }}</dd></div>
        <div class="detail-row"><dt>最近活跃</dt><dd>{{ timeLabel(selected.lastActiveAt) }}</dd></div>
        <div class="detail-row"><dt>登录方式</dt><dd>{{ selected.method }}</dd></div>
      </dl>
    </template>
    <template #footer>
      <button class="btn btn-ghost btn-sm" type="button" @click="detailOpen = false">取消</button>
      <button
        v-if="selected && !selected.current"
        class="btn btn-danger btn-sm"
        type="button"
        @click="detailOpen = false; askUnbind(selected)"
      >
        解绑该设备
      </button>
    </template>
  </BaseModal>

  <BaseModal v-model="confirmOpen" :title="confirmTitle" width="440px">
    <div class="modal-device">
      <span class="device-icon lg">
        <AppIcon :name="confirmType === 'logout' ? 'shield' : 'device'" />
      </span>
      <div>
        <p class="modal-device-name">
          {{ confirmType === 'logout' ? '保留当前设备会话' : confirmTarget?.name }}
        </p>
        <p class="modal-device-sub">
          {{
            confirmType === 'logout'
              ? '其余在线设备将立即退出'
              : confirmType === 'session'
                ? `${confirmTarget?.browser || ''} · ${confirmTarget?.os || ''}`.replace(/ · $/, '')
                : confirmTarget?.location
          }}
        </p>
      </div>
    </div>
    <p class="quiet-text">
      {{
        confirmType === 'logout'
          ? '退出后，其它设备需要重新登录。当前设备不会受到影响。'
          : confirmType === 'session'
            ? '该会话会立即失效，需要重新登录才能继续使用；其它会话不受影响。'
            : '解绑后，该设备将退出服务，再次使用需要重新完成安全验证。'
      }}
    </p>
    <template #footer>
      <button class="btn btn-ghost btn-sm" type="button" @click="confirmOpen = false">取消</button>
      <button class="btn btn-danger btn-sm" type="button" :disabled="confirmLoading" @click="confirmAction">
        <span v-if="confirmLoading" class="spinner" />
        {{ confirmLoading ? '正在执行…' : '确认操作' }}
      </button>
    </template>
  </BaseModal>

  <BaseModal v-model="addOpen" title="添加登录设备" width="460px">
    <div class="modal-device">
      <span class="device-icon lg"><AppIcon :name="iconFor(addForm.kind)" /></span>
      <div>
        <p class="modal-device-name">新设备安全验证</p>
        <p class="modal-device-sub">绑定后将加入可信设备列表</p>
      </div>
      <span class="badge badge-green">安全</span>
    </div>

    <div class="field">
      <label for="device-name">设备名称</label>
      <input id="device-name" v-model="addForm.name" class="input" maxlength="24" placeholder="例如：工作站" />
    </div>
    <div class="field">
      <label for="device-kind">设备类型</label>
      <select id="device-kind" v-model="addForm.kind" class="input">
        <option value="laptop">笔记本 · Laptop</option>
        <option value="phone">手机 · Phone</option>
        <option value="tablet">平板 · Tablet</option>
      </select>
    </div>
    <div class="field">
      <label for="device-os">系统版本（可选）</label>
      <input id="device-os" v-model="addForm.os" class="input" maxlength="40" placeholder="例如：macOS 15 / Windows 11" />
    </div>

    <p v-if="addError" class="form-error"><AppIcon name="shield" /><span>{{ addError }}</span></p>

    <template #footer>
      <button class="btn btn-ghost btn-sm" type="button" @click="addOpen = false">取消</button>
      <button class="btn btn-primary btn-sm" type="button" :disabled="addSaving" @click="submitAdd">
        <span v-if="addSaving" class="spinner" />
        {{ addSaving ? '正在绑定…' : '绑定设备' }}
      </button>
    </template>
  </BaseModal>

  <BaseModal v-model="renameOpen" title="重命名会话" width="440px">
    <div class="modal-device">
      <span class="device-icon lg"><AppIcon name="device" /></span>
      <div>
        <p class="modal-device-name">{{ renameTarget?.defaultName || '登录会话' }}</p>
        <p class="modal-device-sub">{{ renameTarget?.browser }} · {{ renameTarget?.os }}</p>
      </div>
    </div>
    <div class="field">
      <label for="session-name">会话名称</label>
      <input
        id="session-name"
        v-model="renameValue"
        class="input"
        maxlength="24"
        placeholder="例如：家里的笔记本"
      />
      <p class="hint">留空则恢复为系统识别的设备名称，最多 24 个字符。</p>
    </div>
    <p v-if="renameError" class="form-error"><AppIcon name="shield" /><span>{{ renameError }}</span></p>
    <template #footer>
      <button class="btn btn-ghost btn-sm" type="button" @click="renameOpen = false">取消</button>
      <button class="btn btn-primary btn-sm" type="button" :disabled="renameSaving" @click="submitRename">
        <span v-if="renameSaving" class="spinner" />
        {{ renameSaving ? '正在保存…' : '保存名称' }}
      </button>
    </template>
  </BaseModal>

  <BaseModal v-model="logsOpen" title="全部登录记录" width="560px">
    <div v-if="logsLoading" class="feed">
      <SkeletonBlock :rows="6" />
    </div>
    <div v-else class="feed feed-scroll">
      <div v-for="log in allLogs" :key="log.id" class="feed-item">
        <span class="feed-chip" :class="`chip-${log.tone}`"><AppIcon :name="log.icon" /></span>
        <div class="feed-body">
          <p class="feed-title">{{ log.event }}</p>
          <p class="feed-sub">{{ log.detail }}</p>
        </div>
        <span class="feed-time">{{ timeLabel(log.occurredAt) }}</span>
      </div>
      <div v-if="!allLogs.length" class="inline-empty">
        <span class="inline-empty-icon"><AppIcon name="clock" /></span>
        <h3>暂无登录记录</h3>
        <p>设备登录、解绑与安全操作都会记录在这里。</p>
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.feed-scroll{max-height:56vh;overflow-y:auto}
</style>
