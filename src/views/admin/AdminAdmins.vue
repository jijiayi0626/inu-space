<script setup>
import { computed, ref } from 'vue';
import AppIcon from '../../components/AppIcon.vue';
import { api } from '../../lib/api';
import { toast } from '../../lib/toast';

const props = defineProps({
  data: { type: Object, default: null },
  reload: { type: Function, required: true },
  askConfirm: { type: Function, required: true },
});

const admins = computed(() => props.data?.admins || []);

const adminEmail = ref('');
const granting = ref(false);

async function grantAdmin() {
  const email = adminEmail.value.trim();
  if (!email) {
    toast('请输入账号邮箱', 'error');
    return;
  }
  granting.value = true;
  try {
    await api.post('/admin/admins', { email });
    adminEmail.value = '';
    toast('已授予超级管理员权限');
    await props.reload({ silent: true });
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    granting.value = false;
  }
}

function removeAdmin(admin) {
  props.askConfirm({
    title: '移除管理员',
    message: `确定移除 ${admin.name}（${admin.email}）的超级管理员权限吗？`,
    confirmText: '移除权限',
    danger: true,
    action: async () => {
      await api.del(`/admin/admins/${admin.userId}`);
      toast('管理员权限已移除');
      await props.reload({ silent: true });
    },
  });
}
</script>

<template>
  <section class="admin-section">
    <div class="admin-section-head">
      <div>
        <h2>超级管理员</h2>
        <p>拥有管理台全部权限，可以配置登录方式与 OAuth 应用。</p>
      </div>
    </div>

    <div class="card">
      <div class="admin-list">
        <div v-for="admin in admins" :key="admin.userId" class="admin-row">
          <span class="admin-avatar">{{ (admin.name || '管').slice(0, 1) }}</span>
          <div class="admin-copy">
            <strong>{{ admin.name }}<span v-if="admin.email === data?.admins?.[0]?.email" class="badge badge-blue">首位管理员</span></strong>
            <span>{{ admin.email }} · {{ admin.inuId }}</span>
          </div>
          <button class="btn btn-danger btn-sm" type="button" @click="removeAdmin(admin)">移除</button>
        </div>
      </div>

      <div class="admin-grant">
        <div class="field">
          <label for="grant-email">授予其他账号管理员权限</label>
          <input id="grant-email" v-model="adminEmail" class="input" type="email" autocomplete="off" placeholder="输入已注册的 INU 账号邮箱" @keyup.enter="grantAdmin" />
        </div>
        <button class="btn btn-primary" type="button" :disabled="granting" @click="grantAdmin">
          <span v-if="granting" class="spinner" />
          <span>{{ granting ? '授予中…' : '授予权限' }}</span>
        </button>
      </div>
      <p class="hint">也可以通过 Worker 环境变量 ADMIN_EMAILS 指定自动授予管理员的邮箱，多个邮箱用逗号分隔。</p>
    </div>
  </section>
</template>
