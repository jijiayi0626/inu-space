<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { Button, Input, Switch } from 'fuxsto-design-pro';
import AppIcon from '../../components/AppIcon.vue';
import BaseModal from '../../components/BaseModal.vue';
import { api } from '../../lib/api';
import { dateTimeLabel, money } from '../../lib/format';
import { toast } from '../../lib/toast';

const props = defineProps({
  data: { type: Object, default: null },
  reload: { type: Function, required: true },
  askConfirm: { type: Function, required: true },
});

const resetRequestList = computed(() => props.data?.passwordResets || []);
const adminUsers = ref([]);

watch(
  () => props.data?.users,
  (list) => {
    if (list) adminUsers.value = list;
  },
  { immediate: true },
);

const userQuery = ref('');
const usersLoading = ref(false);
const userModal = ref(false);
const userTarget = ref(null);
const userError = ref('');
const userSaving = ref(false);
const userForm = reactive({ name: '', verified: false, particlesDelta: 0, balanceDeltaYuan: 0, password: '' });

async function searchAdminUsers() {
  if (usersLoading.value) return;
  usersLoading.value = true;
  try {
    const q = userQuery.value.trim();
    const result = await api.get(`/admin/users?limit=50${q ? `&q=${encodeURIComponent(q)}` : ''}`, {
      force: true,
      ttl: 0,
    });
    adminUsers.value = result.users || [];
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    usersLoading.value = false;
  }
}

function openUserAdjust(user) {
  userTarget.value = user;
  userForm.name = user.name;
  userForm.verified = user.verified;
  userForm.particlesDelta = 0;
  userForm.balanceDeltaYuan = 0;
  userForm.password = '';
  userError.value = '';
  userModal.value = true;
}

async function submitUserAdjust() {
  if (!userTarget.value || userSaving.value) return;
  userError.value = '';
  if ([...userForm.name.trim()].length < 2 || [...userForm.name.trim()].length > 20) {
    userError.value = '昵称需为 2–20 个字符';
    return;
  }
  const particlesDelta = Math.round(Number(userForm.particlesDelta) || 0);
  const balanceDelta = Math.round(Number(userForm.balanceDeltaYuan) * 100 || 0);
  const payload = {
    name: userForm.name.trim(),
    verified: userForm.verified,
    particlesDelta,
    balanceDelta,
  };
  if (userForm.password.trim()) payload.password = userForm.password;
  userSaving.value = true;
  try {
    await api.patch(`/admin/users/${userTarget.value.id}`, payload);
    toast(userForm.password.trim() ? '用户资料已更新，密码已重置' : '用户资料已更新');
    userModal.value = false;
    await props.reload({ silent: true });
    await searchAdminUsers();
  } catch (error) {
    userError.value = error.message;
  } finally {
    userSaving.value = false;
  }
}

function resolveResetRequest(row) {
  props.askConfirm({
    title: '标记找回申请已处理',
    message: `确认已通过其他方式联系 ${row.userName}（${row.email}）并完成密码找回？`,
    confirmText: '标记已处理',
    action: async () => {
      await api.patch(`/admin/password-resets/${row.id}`, { note: '管理员已联系用户' });
      toast('找回申请已处理');
      await props.reload({ silent: true });
    },
  });
}
</script>

<template>
  <section class="admin-section">
    <div class="admin-section-head">
      <div>
        <h2>用户管理</h2>
        <p>搜索用户、调整昵称、认证状态、积分与账户余额，所有调整都会写入流水与审计。</p>
      </div>
    </div>

    <div v-if="resetRequestList.length" class="card">
      <div class="card-head">
        <h2>密码找回申请</h2>
        <span class="head-note">{{ resetRequestList.length }} 条待处理</span>
      </div>
      <div class="manage-list">
        <div v-for="row in resetRequestList" :key="row.id" class="manage-row">
          <span class="manage-mark is-orange"><AppIcon name="lock" /></span>
          <div class="manage-copy">
            <strong>
              {{ row.userName }}
              <span class="badge badge-orange">待处理</span>
            </strong>
            <span>{{ row.email }}</span>
            <em>{{ row.userInuId }} · {{ dateTimeLabel(row.createdAt) }}</em>
          </div>
          <div class="manage-actions">
            <Button variant="secondary" size="sm" type="button" @click="resolveResetRequest(row)">标记已处理</Button>
          </div>
        </div>
      </div>
      <p class="hint">在用户调整弹窗中填写新密码并保存后，该用户的找回申请会自动完成。</p>
    </div>

    <div class="card">
      <div class="user-search">
        <Input v-model="userQuery" placeholder="搜索邮箱 / 昵称 / INU ID / 手机号" @keyup.enter="searchAdminUsers" />
        <Button variant="primary" type="button" :disabled="usersLoading" @click="searchAdminUsers">
          <span v-if="usersLoading" class="spinner" />
          <span>{{ usersLoading ? '搜索中…' : '搜索用户' }}</span>
        </Button>
      </div>

      <div v-if="!adminUsers.length" class="admin-empty compact">
        <span class="admin-empty-icon"><AppIcon name="user" /></span>
        <h3>没有匹配的用户</h3>
        <p>试试其他关键词，或清空搜索查看最近注册的实名用户。</p>
      </div>

      <div v-else class="manage-list">
        <div v-for="user in adminUsers" :key="user.id" class="manage-row">
          <span class="manage-mark is-purple">{{ (user.name || 'U').slice(0, 1) }}</span>
          <div class="manage-copy">
            <strong>
              {{ user.name }}
              <span class="badge" :class="user.verified ? 'badge-green' : 'badge-gray'">{{ user.verified ? '已认证' : '未认证' }}</span>
              <span v-if="user.isAdmin" class="badge badge-blue">管理员</span>
            </strong>
            <span>{{ user.email }} · {{ user.inuId }}</span>
            <em>{{ money(user.balanceCents) }} 余额 · {{ user.particles }} 积分 · {{ user.phone || '未绑定手机' }} · {{ dateTimeLabel(user.createdAt) }}</em>
          </div>
          <div class="manage-actions">
            <Button variant="secondary" size="sm" type="button" @click="openUserAdjust(user)">调整</Button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- 用户调整 -->
  <BaseModal v-model="userModal" title="调整用户资料" width="520px">
    <div v-if="userTarget" class="modal-form">
      <div class="modal-summary">
        <strong>{{ userTarget.name }}</strong>
        <span>{{ userTarget.email }} · {{ userTarget.inuId }}</span>
        <span>当前 {{ money(userTarget.balanceCents) }} 余额 · {{ userTarget.particles }} 积分</span>
      </div>
      <div class="field">
        <span class="field-label">昵称</span>
        <Input aria-label="昵称" v-model="userForm.name" maxlength="20" />
      </div>
      <div class="public-toggle">
        <Switch v-model="userForm.verified" aria-label="实名认证" />
        <span><strong>实名认证</strong><em>开启后可下单、提现并使用全部功能</em></span>
      </div>
      <div class="field">
        <span class="field-label">重置登录密码</span>
        <Input aria-label="重置登录密码" v-model="userForm.password" type="password" autocomplete="new-password" placeholder="留空表示不修改；至少 8 位且包含字母与数字" />
        <p class="hint">重置后用户需使用新密码登录，待处理的密码找回申请会自动完成。</p>
      </div>
      <div class="settings-fields">
        <div class="field">
          <span class="field-label">积分增减</span>
          <Input aria-label="积分增减" :model-value="userForm.particlesDelta" type="number" placeholder="正数增加，负数扣减" @update:model-value="userForm.particlesDelta = Number($event)" />
        </div>
        <div class="field">
          <span class="field-label">余额增减</span>
          <Input aria-label="余额增减" :model-value="userForm.balanceDeltaYuan" type="number" step="0.01" placeholder="正数增加，负数扣减" @update:model-value="userForm.balanceDeltaYuan = Number($event)" />
        </div>
      </div>
      <p class="hint">积分和余额的调整会写入用户流水与安全日志，并发送站内信。</p>
      <p v-if="userError" class="modal-error">{{ userError }}</p>
    </div>
    <template #footer>
      <Button variant="secondary" type="button" @click="userModal = false">取消</Button>
      <Button variant="primary" type="button" :disabled="userSaving" @click="submitUserAdjust">
        <span v-if="userSaving" class="spinner" />
        <span>{{ userSaving ? '保存中…' : '保存调整' }}</span>
      </Button>
    </template>
  </BaseModal>
</template>
