<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { Button, Input } from 'fuxsto-design-pro';
import AppIcon from './AppIcon.vue';
import BaseModal from './BaseModal.vue';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  kind: { type: String, default: 'phone' },
  current: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue', 'updated']);

const isPhone = computed(() => props.kind === 'phone');
const title = computed(() => (isPhone.value ? (props.current ? '更换绑定手机' : '绑定安全手机') : '更换安全邮箱'));
const targetLabel = computed(() => (isPhone.value ? '手机号' : '新邮箱'));

const form = reactive({ target: '', code: '' });
const devCode = ref('');
const error = ref('');
const sending = ref(false);
const verifying = ref(false);

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    form.target = isPhone.value ? props.current || '' : '';
    form.code = '';
    devCode.value = '';
    error.value = '';
  },
);

const targetValid = computed(() =>
  isPhone.value ? /^1[3-9]\d{9}$/.test(form.target.replace(/\s|-/g, '')) : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.target.trim()),
);

function payload() {
  return isPhone.value
    ? { phone: form.target.replace(/\s|-/g, '') }
    : { email: form.target.trim().toLowerCase() };
}

async function requestCode() {
  error.value = '';
  if (!targetValid.value) {
    error.value = isPhone.value ? '请输入有效的 11 位手机号' : '请输入有效的邮箱地址';
    return;
  }
  sending.value = true;
  try {
    const result = await api.post(isPhone.value ? '/profile/phone/code' : '/profile/email/code', payload());
    devCode.value = result.devCode || '';
    toast(result.message || '验证码已发送');
  } catch (err) {
    error.value = err.message;
  } finally {
    sending.value = false;
  }
}

async function verify() {
  error.value = '';
  if (!targetValid.value) {
    error.value = isPhone.value ? '请输入有效的 11 位手机号' : '请输入有效的邮箱地址';
    return;
  }
  if (!/^\d{6}$/.test(form.code.trim())) {
    error.value = '请输入 6 位验证码';
    return;
  }
  verifying.value = true;
  try {
    const result = await api.post(
      isPhone.value ? '/profile/phone/verify' : '/profile/email/verify',
      { ...payload(), code: form.code.trim() },
    );
    emit('updated', result.user);
    emit('update:modelValue', false);
    toast(isPhone.value ? '手机号已绑定，安全能力已增强' : '安全邮箱已更换');
  } catch (err) {
    error.value = err.message;
  } finally {
    verifying.value = false;
  }
}
</script>

<template>
  <BaseModal :model-value="modelValue" :title="title" width="440px" @update:model-value="emit('update:modelValue', $event)">
    <div class="modal-device">
      <span class="device-icon lg"><AppIcon :name="isPhone ? 'phone' : 'mail'" /></span>
      <div>
        <p class="modal-device-name">{{ isPhone ? '短信安全验证' : '邮箱安全验证' }}</p>
        <p class="modal-device-sub">
          {{ current ? `当前：${current}` : isPhone ? '绑定后可用于登录验证与账号找回' : '用于接收安全提醒与协议通知' }}
        </p>
      </div>
      <span class="badge badge-green">安全</span>
    </div>

    <div class="field">
      <span class="field-label">{{ targetLabel }}</span>
      <div class="input-inline">
        <Input :aria-label="targetLabel" v-model="form.target" :type="isPhone ? 'tel' : 'email'" :maxlength="isPhone ? 11 : 80" :placeholder="isPhone ? '11 位手机号' : 'name@example.com'" autocomplete="off" />
        <Button variant="secondary" size="sm" type="button" :disabled="sending" @click="requestCode">
          <span v-if="sending" class="spinner" />
          {{ sending ? '发送中…' : '获取验证码' }}
        </Button>
      </div>
      <p v-if="devCode" class="dev-code">
        演示验证码 <strong>{{ devCode }}</strong> · 10 分钟内有效
      </p>
      <p v-else class="hint">验证码 10 分钟内有效，最多尝试 5 次</p>
    </div>

    <div class="field">
      <span class="field-label">验证码</span>
      <Input aria-label="验证码" v-model="form.code" class="mono" type="text" inputmode="numeric" maxlength="6" placeholder="输入 6 位验证码" autocomplete="one-time-code" />
    </div>

    <p v-if="error" class="form-error"><AppIcon name="shield" /><span>{{ error }}</span></p>

    <template #footer>
      <Button variant="secondary" size="sm" type="button" @click="emit('update:modelValue', false)">取消</Button>
      <Button variant="primary" size="sm" type="button" :disabled="verifying" @click="verify">
        <span v-if="verifying" class="spinner" />
        {{ verifying ? '正在验证…' : '确认绑定' }}
      </Button>
    </template>
  </BaseModal>
</template>

<style scoped>
.dev-code{
  margin-top:var(--s-2);padding:var(--s-2) var(--s-3);border-radius:var(--r-sm);font-size:var(--fx-text-xs);line-height:1.6;
  color:var(--fx-foreground);background:var(--fx-muted);
}
.dev-code strong{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em}
</style>
