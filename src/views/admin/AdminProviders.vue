<script setup>
import { computed, reactive, watch } from 'vue';
import { Button, Input, Switch } from 'fuxsto-design-pro';
import AppIcon from '../../components/AppIcon.vue';
import { api } from '../../lib/api';
import { copyText, sourceLabel } from '../../lib/adminHelpers';
import { toast } from '../../lib/toast';

const props = defineProps({
  data: { type: Object, default: null },
  reload: { type: Function, required: true },
  askConfirm: { type: Function, required: true },
});

const providers = computed(() => props.data?.providers || []);
const configReady = computed(() => Boolean(props.data?.config?.secretKeyReady));

const providerForms = reactive({
  github: { clientId: '', clientSecret: '', enabled: false, saving: false },
  google: { clientId: '', clientSecret: '', enabled: false, saving: false },
});

watch(
  providers,
  (list) => {
    for (const provider of list) {
      const form = providerForms[provider.id];
      if (!form) continue;
      form.clientId = provider.clientId || '';
      form.clientSecret = '';
      form.enabled = provider.enabled;
    }
  },
  { immediate: true },
);

async function saveProvider(provider) {
  const form = providerForms[provider.id];
  if (!form) return;
  if (form.enabled && !form.clientId.trim()) {
    toast('启用前请填写 Client ID', 'error');
    return;
  }
  form.saving = true;
  try {
    await api.patch(`/admin/providers/${provider.id}`, {
      clientId: form.clientId.trim(),
      clientSecret: form.clientSecret,
      enabled: form.enabled,
      clearSecret: false,
    });
    form.clientSecret = '';
    toast(`${provider.label} 登录配置已保存`);
    await props.reload({ silent: true });
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    form.saving = false;
  }
}
</script>

<template>
  <section class="admin-section">
    <div v-if="!configReady" class="admin-alert">
      <AppIcon name="lock" />
      <div>
        <strong>尚未配置 CONFIG_KEY</strong>
        <p>Client Secret 需要加密后写入 D1。请先为 Worker 设置 CONFIG_KEY 环境密钥，再在下方保存新的密钥。</p>
      </div>
    </div>

    <div class="provider-grid">
      <article v-for="provider in providers" :key="provider.id" class="card provider-card">
        <div class="provider-head">
          <span class="provider-mark" :class="`is-${provider.id}`">
            <AppIcon :name="provider.id === 'github' ? 'github' : 'google'" />
          </span>
          <div class="provider-title">
            <strong>{{ provider.label }}</strong>
            <span>
              <span class="badge" :class="provider.enabled ? 'badge-green' : 'badge-gray'">
                {{ provider.enabled ? '已启用' : '未启用' }}
              </span>
              <span class="badge badge-blue">{{ sourceLabel(provider.source) }}</span>
              <span v-if="provider.backup" class="badge badge-orange">备用</span>
            </span>
          </div>
          <Switch
            v-model="providerForms[provider.id].enabled"
            :aria-label="`启用 ${provider.label} 登录`"
          />
        </div>

        <p v-if="provider.secretError" class="provider-warn">
          已保存的 Client Secret 无法解密，请重新保存密钥或检查 CONFIG_KEY。
        </p>

        <div class="provider-fields">
          <div class="field">
            <span class="field-label">Client ID</span>
            <Input aria-label="Client ID" v-model="providerForms[provider.id].clientId" autocomplete="off" placeholder="填写 OAuth App 的 Client ID" />
          </div>
          <div class="field">
            <span class="field-label">Client Secret</span>
            <Input aria-label="Client Secret" v-model="providerForms[provider.id].clientSecret" type="password" autocomplete="new-password" :placeholder="provider.hasSecret ? '已保存，留空表示不修改' : '填写 Client Secret'" />
          </div>
        </div>

        <div class="provider-callback">
          <span class="provider-label">回调地址</span>
          <div class="copy-line">
            <code>{{ provider.callbackUrl }}</code>
            <button class="icon-btn copy-btn" type="button" aria-label="复制回调地址" @click="copyText(provider.callbackUrl, '回调地址已复制')">
              <AppIcon name="copy" />
            </button>
          </div>
        </div>

        <div class="provider-foot">
          <span class="provider-hint">
            {{ provider.id === 'github' ? 'GitHub 只允许填写一个回调地址' : 'Google 支持多个回调地址' }}
          </span>
          <Button variant="primary" size="sm" type="button" :disabled="providerForms[provider.id].saving" @click="saveProvider(provider)">
            <span v-if="providerForms[provider.id].saving" class="spinner" />
            <span>{{ providerForms[provider.id].saving ? '保存中…' : '保存配置' }}</span>
          </Button>
        </div>
      </article>
    </div>

    <div class="card provider-note">
      <AppIcon name="info" />
      <p>
        保存后立即生效，无需重新部署。未填写 Client Secret 时会保留已保存的密钥；
        GitHub / Google 平台上的回调地址必须与上方完全一致。
      </p>
    </div>
  </section>
</template>
