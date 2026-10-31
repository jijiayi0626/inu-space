<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppIcon from '../components/AppIcon.vue';
import BaseModal from '../components/BaseModal.vue';
import PageHeader from '../components/PageHeader.vue';
import SkeletonBlock from '../components/SkeletonBlock.vue';
import { adminSections } from '../lib/adminSections';
import { api } from '../lib/api';
import { dateTimeLabel, money, timeLabel } from '../lib/format';
import { toast } from '../lib/toast';
import { useAsyncData } from '../lib/useAsyncData';

const { data, reload } = useAsyncData(({ force }) => api.get('/admin', { force, ttl: 0 }));

const route = useRoute();
const router = useRouter();
const tabs = adminSections;
const tab = computed(() => {
  const key = String(route.params.section || '');
  return tabs.some((item) => item.key === key) ? key : 'providers';
});

function switchTab(key) {
  if (key !== tab.value) router.push(`/admin/${key}`);
}

const stats = computed(() => data.value?.stats || {});
const providers = computed(() => data.value?.providers || []);
const clients = computed(() => data.value?.clients || []);
const admins = computed(() => data.value?.admins || []);
const audit = computed(() => data.value?.audit || []);
const endpoints = computed(() => data.value?.endpoints || {});
const scopes = computed(() => data.value?.scopes || []);
const configReady = computed(() => Boolean(data.value?.config?.secretKeyReady));
const productList = computed(() => data.value?.products || []);
const templateList = computed(() => data.value?.agreementTemplates || []);
const orderList = computed(() => data.value?.orders || []);
const withdrawalList = computed(() => data.value?.withdrawals || []);
const rechargeList = computed(() => data.value?.recharges || []);
const resetRequestList = computed(() => data.value?.passwordResets || []);
const finance = computed(() => data.value?.finance || {});
const adminUsers = ref([]);

watch(
  () => data.value?.users,
  (list) => {
    if (list) adminUsers.value = list;
  },
  { immediate: true },
);

/* ---------- 站点设置 ---------- */

const siteForm = reactive({
  demoVisible: false,
  demoReadOnly: true,
  noticeEnabled: false,
  noticeText: '',
  noticeLevel: 'info',
  footerText: '',
  loginWelcome: '',
  supportEmail: '',
  walletCardLast4: '',
  featureRecharge: true,
  featureWithdraw: false,
  featurePhoneBind: true,
  featureEmailChange: true,
  featureAvatar: true,
  featureSupply: true,
  featureAgreements: true,
  featureRegister: false,
  featureVerification: true,
  paymentMode: 'mock',
  verificationMode: 'console',
  rechargePresets: '50,100,200,500,1000',
  withdrawMinYuan: 100,
  nameChangeDays: 30,
  maintenanceEnabled: false,
  maintenanceText: '',
  saving: false,
});

watch(
  () => data.value?.settings,
  (settings) => {
    if (!settings) return;
    siteForm.demoVisible = Boolean(settings.demoVisible);
    siteForm.demoReadOnly = Boolean(settings.demoReadOnly);
    siteForm.noticeEnabled = Boolean(settings.noticeEnabled);
    siteForm.noticeText = settings.noticeText || '';
    siteForm.noticeLevel = settings.noticeLevel || 'info';
    siteForm.footerText = settings.footerText || '';
    siteForm.loginWelcome = settings.loginWelcome || '';
    siteForm.supportEmail = settings.supportEmail || '';
    siteForm.walletCardLast4 = settings.walletCardLast4 || '';
    siteForm.featureRecharge = Boolean(settings.featureRecharge);
    siteForm.featureWithdraw = Boolean(settings.featureWithdraw);
    siteForm.featurePhoneBind = Boolean(settings.featurePhoneBind);
    siteForm.featureEmailChange = Boolean(settings.featureEmailChange);
    siteForm.featureAvatar = Boolean(settings.featureAvatar);
    siteForm.featureSupply = Boolean(settings.featureSupply);
    siteForm.featureAgreements = Boolean(settings.featureAgreements);
    siteForm.featureRegister = Boolean(settings.featureRegister);
    siteForm.featureVerification = settings.featureVerification !== false;
    siteForm.paymentMode = settings.paymentMode || 'mock';
    siteForm.verificationMode = settings.verificationMode || 'console';
    siteForm.rechargePresets = (settings.rechargePresets || []).join(',');
    siteForm.withdrawMinYuan = Math.round((settings.withdrawMinCents || 10000) / 100);
    siteForm.nameChangeDays = settings.nameChangeDays ?? 30;
    siteForm.maintenanceEnabled = Boolean(settings.maintenanceEnabled);
    siteForm.maintenanceText = settings.maintenanceText || '';
  },
  { immediate: true },
);

async function saveSiteSettings() {
  if (siteForm.saving) return;
  if (siteForm.noticeEnabled && !siteForm.noticeText.trim()) {
    toast('开启公告前请填写公告内容', 'error');
    return;
  }
  if (siteForm.maintenanceEnabled && !siteForm.maintenanceText.trim()) {
    toast('开启维护模式前请填写维护提示', 'error');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(siteForm.supportEmail.trim())) {
    toast('请输入有效的客服邮箱', 'error');
    return;
  }
  if (!/^\d{4}$/.test(siteForm.walletCardLast4.trim())) {
    toast('钱包尾号需为 4 位数字', 'error');
    return;
  }
  const presets = siteForm.rechargePresets
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item >= 1 && item <= 100000);
  if (!presets.length || presets.length > 8) {
    toast('请填写 1–8 个充值金额（元），用逗号分隔', 'error');
    return;
  }
  const withdrawMinYuan = Number(siteForm.withdrawMinYuan);
  if (!Number.isFinite(withdrawMinYuan) || withdrawMinYuan < 10 || withdrawMinYuan > 50000) {
    toast('提现门槛需在 10–50000 星能之间', 'error');
    return;
  }
  const nameChangeDays = Number(siteForm.nameChangeDays);
  if (!Number.isFinite(nameChangeDays) || nameChangeDays < 0 || nameChangeDays > 365) {
    toast('昵称修改间隔需在 0–365 天之间', 'error');
    return;
  }
  siteForm.saving = true;
  try {
    await api.patch('/admin/settings', {
      demoVisible: siteForm.demoVisible,
      demoReadOnly: siteForm.demoReadOnly,
      noticeEnabled: siteForm.noticeEnabled,
      noticeText: siteForm.noticeText.trim(),
      noticeLevel: siteForm.noticeLevel,
      footerText: siteForm.footerText.trim(),
      loginWelcome: siteForm.loginWelcome.trim(),
      supportEmail: siteForm.supportEmail.trim(),
      walletCardLast4: siteForm.walletCardLast4.trim(),
      featureRecharge: siteForm.featureRecharge,
      featureWithdraw: siteForm.featureWithdraw,
      featurePhoneBind: siteForm.featurePhoneBind,
      featureEmailChange: siteForm.featureEmailChange,
      featureAvatar: siteForm.featureAvatar,
      featureSupply: siteForm.featureSupply,
      featureAgreements: siteForm.featureAgreements,
      featureRegister: siteForm.featureRegister,
      featureVerification: siteForm.featureVerification,
      paymentMode: siteForm.paymentMode,
      verificationMode: siteForm.verificationMode,
      rechargePresets: presets,
      withdrawMinCents: Math.round(withdrawMinYuan * 100),
      nameChangeDays: Math.round(nameChangeDays),
      maintenanceEnabled: siteForm.maintenanceEnabled,
      maintenanceText: siteForm.maintenanceText.trim(),
    });
    toast('站点设置已保存，刷新页面后生效');
    await reload({ silent: true });
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    siteForm.saving = false;
  }
}

/* ---------- AI 接入文档 ---------- */

async function readIntegrationDoc() {
  const response = await fetch('/inu-oauth-integration.md', { cache: 'no-store' });
  if (!response.ok) throw new Error('接入文档读取失败，请确认已部署最新版本');
  const template = await response.text();
  const origin = endpoints.value.issuer || window.location.origin;
  return template.split('{{INU_ORIGIN}}').join(origin);
}

async function downloadIntegrationDoc() {
  try {
    const text = await readIntegrationDoc();
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'inu-oauth-integration.md';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('AI 接入文档已下载');
  } catch (error) {
    toast(error.message || '下载失败', 'error');
  }
}

async function copyIntegrationDoc() {
  try {
    const text = await readIntegrationDoc();
    await copyText(text, '接入文档已复制，可直接粘贴给 AI');
  } catch (error) {
    toast(error.message || '复制失败', 'error');
  }
}

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

async function copyText(value, label = '已复制') {
  const text = String(value || '');
  if (!text) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
    }
    toast(label);
  } catch {
    toast('复制失败，请手动选择文本', 'error');
  }
}

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
    await reload({ silent: true });
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    form.saving = false;
  }
}

/* ---------- OAuth 应用 ---------- */

const clientModal = ref(false);
const editingClient = ref(null);
const savingClient = ref(false);
const clientError = ref('');
const clientForm = reactive({
  name: '',
  description: '',
  homepageUrl: '',
  redirectUris: '',
  scopes: ['profile', 'email'],
  isPublic: false,
});

function resetClientForm() {
  clientForm.name = '';
  clientForm.description = '';
  clientForm.homepageUrl = '';
  clientForm.redirectUris = '';
  clientForm.scopes = ['profile', 'email'];
  clientForm.isPublic = false;
  clientError.value = '';
}

function openCreateClient() {
  editingClient.value = null;
  resetClientForm();
  clientModal.value = true;
}

function openEditClient(client) {
  editingClient.value = client;
  clientForm.name = client.name;
  clientForm.description = client.description || '';
  clientForm.homepageUrl = client.homepageUrl || '';
  clientForm.redirectUris = client.redirectUris.join('\n');
  clientForm.scopes = [...client.scopes];
  clientForm.isPublic = client.isPublic;
  clientError.value = '';
  clientModal.value = true;
}

function toggleScope(key) {
  if (clientForm.scopes.includes(key)) {
    clientForm.scopes = clientForm.scopes.filter((item) => item !== key);
  } else {
    clientForm.scopes = [...clientForm.scopes, key];
  }
}

const secretModal = ref(false);
const secretValue = ref('');
const secretClientName = ref('');

function revealSecret(name, secret) {
  secretClientName.value = name;
  secretValue.value = secret;
  secretModal.value = true;
}

async function submitClient() {
  clientError.value = '';
  const name = clientForm.name.trim();
  const redirectUris = clientForm.redirectUris
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  if ([...name].length < 2 || [...name].length > 40) {
    clientError.value = '应用名称需为 2–40 个字符';
    return;
  }
  if (!redirectUris.length) {
    clientError.value = '请至少填写一个回调地址';
    return;
  }
  if (!clientForm.scopes.length) {
    clientError.value = '请至少选择一个权限范围';
    return;
  }

  const payload = {
    name,
    description: clientForm.description.trim(),
    homepageUrl: clientForm.homepageUrl.trim(),
    redirectUris,
    scopes: clientForm.scopes,
  };
  if (!editingClient.value) payload.isPublic = clientForm.isPublic;

  savingClient.value = true;
  try {
    if (editingClient.value) {
      await api.patch(`/admin/oauth-clients/${editingClient.value.id}`, payload);
      toast('应用配置已更新');
    } else {
      const result = await api.post('/admin/oauth-clients', payload);
      toast('应用已创建');
      if (result.clientSecret) revealSecret(name, result.clientSecret);
    }
    clientModal.value = false;
    await reload({ silent: true });
  } catch (error) {
    clientError.value = error.message;
  } finally {
    savingClient.value = false;
  }
}

async function toggleClient(client, event) {
  const enabled = event.target.checked;
  try {
    await api.patch(`/admin/oauth-clients/${client.id}`, { enabled });
    toast(`${client.name} 已${enabled ? '启用' : '停用'}`);
    await reload({ silent: true });
  } catch (error) {
    event.target.checked = client.enabled;
    toast(error.message, 'error');
  }
}

/* ---------- 通用确认 ---------- */

const confirmState = reactive({
  open: false,
  title: '',
  message: '',
  confirmText: '确认',
  danger: false,
  loading: false,
  action: null,
});

function askConfirm({ title, message, confirmText = '确认', danger = false, action }) {
  confirmState.title = title;
  confirmState.message = message;
  confirmState.confirmText = confirmText;
  confirmState.danger = danger;
  confirmState.action = action;
  confirmState.open = true;
}

async function runConfirm() {
  if (!confirmState.action) return;
  confirmState.loading = true;
  try {
    await confirmState.action();
    confirmState.open = false;
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    confirmState.loading = false;
  }
}

function rotateSecret(client) {
  askConfirm({
    title: '重置 Client Secret',
    message: `重置后，${client.name} 的旧密钥会立即失效，需要把新密钥更新到应用配置中。`,
    confirmText: '重置密钥',
    action: async () => {
      const result = await api.post(`/admin/oauth-clients/${client.id}/rotate-secret`);
      revealSecret(client.name, result.clientSecret);
      toast('Client Secret 已重置');
      await reload({ silent: true });
    },
  });
}

function deleteClient(client) {
  askConfirm({
    title: '删除 OAuth 应用',
    message: `删除 ${client.name} 后，该应用签发的全部令牌与用户授权都会失效，且无法恢复。`,
    confirmText: '删除应用',
    danger: true,
    action: async () => {
      await api.del(`/admin/oauth-clients/${client.id}`);
      toast('应用已删除');
      await reload({ silent: true });
    },
  });
}

/* ---------- 管理员 ---------- */

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
    await reload({ silent: true });
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    granting.value = false;
  }
}

function removeAdmin(admin) {
  askConfirm({
    title: '移除管理员',
    message: `确定移除 ${admin.name}（${admin.email}）的超级管理员权限吗？`,
    confirmText: '移除权限',
    danger: true,
    action: async () => {
      await api.del(`/admin/admins/${admin.userId}`);
      toast('管理员权限已移除');
      await reload({ silent: true });
    },
  });
}

function scopeLabel(key) {
  return scopes.value.find((item) => item.key === key)?.label || key;
}

function sourceLabel(source) {
  if (source === 'db') return '管理台配置';
  if (source === 'env') return '环境变量';
  return '未配置';
}

/* ---------- 商品管理 ---------- */

function bareIcon(value) {
  return String(value || 'box').replace(/^i-/, '');
}

function orderStatusLabel(status) {
  return ORDER_STATUS_OPTIONS.find((item) => item.key === status)?.label || status;
}

function stockLabel(stock) {
  return Number(stock) < 0 ? '不限' : Number(stock);
}

const TONES = ['blue', 'purple', 'cyan', 'green', 'orange'];
const PRODUCT_ICONS = ['i-box', 'i-orbit', 'i-star', 'i-spark', 'i-moon', 'i-sun', 'i-map', 'i-file', 'i-device', 'i-lock'];

const productModal = ref(false);
const editingProduct = ref(null);
const savingProduct = ref(false);
const productError = ref('');
const productForm = reactive({
  id: '',
  name: '',
  desc: '',
  priceYuan: '128',
  icon: 'i-box',
  tag: '',
  tone: 'blue',
  stock: -1,
  sort: 0,
  active: true,
});

function openCreateProduct() {
  editingProduct.value = null;
  Object.assign(productForm, {
    id: '',
    name: '',
    desc: '',
    priceYuan: '128',
    icon: 'i-box',
    tag: '',
    tone: 'blue',
    stock: -1,
    sort: 0,
    active: true,
  });
  productError.value = '';
  productModal.value = true;
}

function openEditProduct(product) {
  editingProduct.value = product;
  Object.assign(productForm, {
    id: product.id,
    name: product.name,
    desc: product.desc || '',
    priceYuan: (product.priceCents / 100).toFixed(2).replace(/\.?0+$/, '') || '0',
    icon: product.icon,
    tag: product.tag || '',
    tone: product.tone || 'blue',
    stock: product.stock,
    sort: product.sort,
    active: product.active,
  });
  productError.value = '';
  productModal.value = true;
}

async function submitProduct() {
  productError.value = '';
  const name = productForm.name.trim();
  if ([...name].length < 1 || [...name].length > 40) {
    productError.value = '商品名称需为 1–40 个字符';
    return;
  }
  const priceCents = Math.round(Number(productForm.priceYuan) * 100);
  if (!Number.isFinite(priceCents) || priceCents < 100 || priceCents > 10000000) {
    productError.value = '商品价格需在 1–100000 星能之间';
    return;
  }
  const payload = {
    name,
    desc: productForm.desc.trim(),
    priceCents,
    icon: productForm.icon,
    tag: productForm.tag.trim(),
    tone: productForm.tone,
    stock: Math.round(Number(productForm.stock)),
    sort: Math.round(Number(productForm.sort)),
    active: productForm.active,
  };
  savingProduct.value = true;
  try {
    if (editingProduct.value) {
      await api.patch(`/admin/products/${editingProduct.value.id}`, payload);
      toast('商品已更新');
    } else {
      if (productForm.id.trim()) payload.id = productForm.id.trim().toLowerCase();
      await api.post('/admin/products', payload);
      toast('商品已创建');
    }
    productModal.value = false;
    await reload({ silent: true });
  } catch (error) {
    productError.value = error.message;
  } finally {
    savingProduct.value = false;
  }
}

function deleteProduct(product) {
  askConfirm({
    title: '删除补给商品',
    message: `删除「${product.name}」后，补给站将不再展示该商品，历史订单不受影响。`,
    confirmText: '删除商品',
    danger: true,
    action: async () => {
      await api.del(`/admin/products/${product.id}`);
      toast('商品已删除');
      await reload({ silent: true });
    },
  });
}

/* ---------- 协议模板管理 ---------- */

const templateModal = ref(false);
const editingTemplate = ref(null);
const savingTemplate = ref(false);
const templateError = ref('');
const templateForm = reactive({
  title: '',
  version: 'v1.0',
  content: '',
  reward: 50,
  sort: 0,
  active: true,
});

function openCreateTemplate() {
  editingTemplate.value = null;
  Object.assign(templateForm, { title: '', version: 'v1.0', content: '', reward: 50, sort: 0, active: true });
  templateError.value = '';
  templateModal.value = true;
}

function openEditTemplate(template) {
  editingTemplate.value = template;
  Object.assign(templateForm, {
    title: template.title,
    version: template.version,
    content: template.content || '',
    reward: template.reward,
    sort: template.sort,
    active: template.active,
  });
  templateError.value = '';
  templateModal.value = true;
}

async function submitTemplate() {
  templateError.value = '';
  if ([...templateForm.title.trim()].length < 2) {
    templateError.value = '协议名称需为 2–40 个字符';
    return;
  }
  if ([...templateForm.content].length < 10) {
    templateError.value = '协议正文至少需要 10 个字符';
    return;
  }
  const payload = {
    title: templateForm.title.trim(),
    version: templateForm.version.trim(),
    content: templateForm.content,
    reward: Math.round(Number(templateForm.reward)),
    sort: Math.round(Number(templateForm.sort)),
    active: templateForm.active,
  };
  savingTemplate.value = true;
  try {
    if (editingTemplate.value) {
      await api.patch(`/admin/agreement-templates/${editingTemplate.value.id}`, payload);
      toast('协议模板已更新，待签署协议已同步');
    } else {
      await api.post('/admin/agreement-templates', payload);
      toast('协议模板已创建，并已为全部用户生成待签记录');
    }
    templateModal.value = false;
    await reload({ silent: true });
  } catch (error) {
    templateError.value = error.message;
  } finally {
    savingTemplate.value = false;
  }
}

function deleteTemplate(template) {
  askConfirm({
    title: '删除协议模板',
    message: `删除「${template.title}」后，新用户将不再收到该协议；已签署记录仍会保留。`,
    confirmText: '删除模板',
    danger: true,
    action: async () => {
      await api.del(`/admin/agreement-templates/${template.id}`);
      toast('协议模板已删除');
      await reload({ silent: true });
    },
  });
}

/* ---------- 站内信广播 ---------- */

const NOTIFICATION_CATEGORIES = [
  { key: 'type_security', label: '账户安全提醒' },
  { key: 'type_supply', label: '星际补给动态' },
  { key: 'type_energy', label: '星能变动' },
  { key: 'type_member', label: '会员权益与等级' },
  { key: 'type_radio', label: '星际电台与活动' },
];

const broadcastForm = reactive({
  title: '',
  body: '',
  category: 'type_radio',
  link: '',
  email: '',
  sending: false,
});

async function sendBroadcast() {
  if (broadcastForm.sending) return;
  if ([...broadcastForm.title.trim()].length < 2) {
    toast('消息标题需为 2–40 个字符', 'error');
    return;
  }
  if ([...broadcastForm.body.trim()].length < 2) {
    toast('消息正文需为 2–300 个字符', 'error');
    return;
  }
  broadcastForm.sending = true;
  try {
    const result = await api.post('/admin/notifications', {
      title: broadcastForm.title.trim(),
      body: broadcastForm.body.trim(),
      category: broadcastForm.category,
      link: broadcastForm.link.trim(),
      email: broadcastForm.email.trim().toLowerCase(),
    });
    toast(`站内信已发送 ${result.sent}/${result.total}`);
    broadcastForm.title = '';
    broadcastForm.body = '';
    broadcastForm.link = '';
    broadcastForm.email = '';
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    broadcastForm.sending = false;
  }
}

/* ---------- 订单管理 ---------- */

const ORDER_STATUS_OPTIONS = [
  { key: 'pending_payment', label: '待支付' },
  { key: 'transit', label: '跃迁中' },
  { key: 'delivered', label: '已签收' },
  { key: 'cancelled', label: '已取消' },
];
const ORDER_STATUS_TONES = {
  pending_payment: 'badge-orange',
  transit: 'badge-blue',
  delivered: 'badge-green',
  cancelled: 'badge-gray',
};

const WITHDRAW_STATUS = {
  processing: { label: '待复核', tone: 'badge-orange' },
  paid: { label: '已打款', tone: 'badge-green' },
  rejected: { label: '已驳回', tone: 'badge-gray' },
};

const orderModal = ref(false);
const orderTarget = ref(null);
const savingOrder = ref(false);
const orderError = ref('');
const orderForm = reactive({ status: 'pending_payment', carrier: '', trackingNo: '' });

function openOrderAdmin(order) {
  orderTarget.value = order;
  orderForm.status = order.status;
  orderForm.carrier = order.carrier || '';
  orderForm.trackingNo = order.trackingNo || '';
  orderError.value = '';
  orderModal.value = true;
}

async function submitOrder() {
  if (!orderTarget.value || savingOrder.value) return;
  orderError.value = '';
  savingOrder.value = true;
  try {
    const result = await api.patch(`/admin/orders/${orderTarget.value.id}`, {
      status: orderForm.status,
      carrier: orderForm.carrier.trim(),
      trackingNo: orderForm.trackingNo.trim(),
    });
    toast(result.refunded ? `订单已更新，已退回 ${money(result.refunded)} 星能` : '订单已更新');
    orderModal.value = false;
    await reload({ silent: true });
  } catch (error) {
    orderError.value = error.message;
  } finally {
    savingOrder.value = false;
  }
}

/* ---------- 提现处理 ---------- */

const withdrawModal = ref(false);
const withdrawTarget = ref(null);
const withdrawNote = ref('');
const withdrawBusy = ref(false);

function openWithdraw(row) {
  withdrawTarget.value = row;
  withdrawNote.value = '';
  withdrawModal.value = true;
}

async function processWithdraw(action) {
  if (!withdrawTarget.value || withdrawBusy.value) return;
  withdrawBusy.value = true;
  try {
    await api.patch(`/admin/withdrawals/${withdrawTarget.value.id}`, {
      action,
      note: withdrawNote.value.trim(),
    });
    toast(action === 'approve' ? '提现已通过，已标记为打款完成' : '提现已驳回，星能已退回用户钱包');
    withdrawModal.value = false;
    await reload({ silent: true });
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    withdrawBusy.value = false;
  }
}

/* ---------- 用户管理 ---------- */

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
    await reload({ silent: true });
    await searchAdminUsers();
  } catch (error) {
    userError.value = error.message;
  } finally {
    userSaving.value = false;
  }
}

function resolveResetRequest(row) {
  askConfirm({
    title: '标记找回申请已处理',
    message: `确认已通过其他方式联系 ${row.userName}（${row.email}）并完成密码找回？`,
    confirmText: '标记已处理',
    action: async () => {
      await api.patch(`/admin/password-resets/${row.id}`, { note: '管理员已联系用户' });
      toast('找回申请已处理');
      await reload({ silent: true });
    },
  });
}
</script>

<template>
  <PageHeader title="超级管理台" sub="配置第三方登录、站点设置、OAuth 应用与审计记录。">
    <template #meta>
      <span class="badge badge-blue">SUPER ADMIN</span>
      <span class="head-date">仅超级管理员可见</span>
    </template>
  </PageHeader>

  <section v-if="!data" class="card">
    <SkeletonBlock :rows="10" row-height="18px" />
  </section>

  <template v-else>
    <section class="admin-banner">
      <div class="admin-banner-copy">
        <span class="admin-kicker"><span class="pulse-dot" />INU IDENTITY CONTROL</span>
        <h2>一张通行证，连接整个星际生态。</h2>
        <p>让第三方应用通过 INU 账号登录，同时统一管理登录入口、站点呈现与访问权限。</p>
      </div>
      <div class="admin-orbit" aria-hidden="true">
        <span class="admin-ring ring-one" />
        <span class="admin-ring ring-two" />
        <span class="admin-core">INU</span>
        <span class="admin-dot dot-one" />
        <span class="admin-dot dot-two" />
      </div>
    </section>

    <div class="admin-stats">
      <div class="admin-stat">
        <span class="admin-stat-icon is-blue"><AppIcon name="user" /></span>
        <div><strong>{{ stats.users }}</strong><span>星际公民</span></div>
        <em>{{ stats.verifiedUsers }} 已认证</em>
      </div>
      <div class="admin-stat">
        <span class="admin-stat-icon is-purple"><AppIcon name="plug" /></span>
        <div><strong>{{ stats.clients }}</strong><span>接入应用</span></div>
        <em>{{ stats.enabledClients }} 个启用中</em>
      </div>
      <div class="admin-stat">
        <span class="admin-stat-icon is-cyan"><AppIcon name="key" /></span>
        <div><strong>{{ stats.activeTokens }}</strong><span>有效令牌</span></div>
        <em>近 7 天签发 {{ stats.issued7d }}</em>
      </div>
      <div class="admin-stat">
        <span class="admin-stat-icon is-green"><AppIcon name="shield" /></span>
        <div><strong>{{ stats.consents }}</strong><span>用户授权</span></div>
        <em>覆盖 {{ stats.clients }} 个应用</em>
      </div>
    </div>

    <div class="admin-tabs" role="tablist" aria-label="管理台分区">
      <button
        v-for="item in tabs"
        :key="item.key"
        type="button"
        role="tab"
        class="admin-tab"
        :class="{ active: tab === item.key }"
        :aria-selected="tab === item.key"
        @click="switchTab(item.key)"
      >
        <AppIcon :name="item.icon" />
        <span>{{ item.label }}</span>
      </button>
    </div>

    <!-- 第三方登录配置 -->
    <section v-if="tab === 'providers'" class="admin-section">
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
            <label class="switch" :aria-label="`启用 ${provider.label} 登录`">
              <input v-model="providerForms[provider.id].enabled" type="checkbox" />
              <span class="track" />
              <span class="thumb" />
            </label>
          </div>

          <p v-if="provider.secretError" class="provider-warn">
            已保存的 Client Secret 无法解密，请重新保存密钥或检查 CONFIG_KEY。
          </p>

          <div class="provider-fields">
            <div class="field">
              <label :for="`${provider.id}-client-id`">Client ID</label>
              <input
                :id="`${provider.id}-client-id`"
                v-model="providerForms[provider.id].clientId"
                class="input"
                autocomplete="off"
                placeholder="填写 OAuth App 的 Client ID"
              />
            </div>
            <div class="field">
              <label :for="`${provider.id}-client-secret`">Client Secret</label>
              <input
                :id="`${provider.id}-client-secret`"
                v-model="providerForms[provider.id].clientSecret"
                class="input"
                type="password"
                autocomplete="new-password"
                :placeholder="provider.hasSecret ? '已保存，留空表示不修改' : '填写 Client Secret'"
              />
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
            <button class="btn btn-primary btn-sm" type="button" :disabled="providerForms[provider.id].saving" @click="saveProvider(provider)">
              <span v-if="providerForms[provider.id].saving" class="spinner" />
              <span>{{ providerForms[provider.id].saving ? '保存中…' : '保存配置' }}</span>
            </button>
          </div>
        </article>
      </div>

      <div class="card provider-note">
        <AppIcon name="spark" />
        <p>
          保存后立即生效，无需重新部署。未填写 Client Secret 时会保留已保存的密钥；
          GitHub / Google 平台上的回调地址必须与上方完全一致。
        </p>
      </div>
    </section>

    <!-- 站点设置 -->
    <section v-if="tab === 'settings'" class="admin-section">
      <div class="admin-section-head">
        <div>
          <h2>站点设置</h2>
          <p>控制演示账号入口、只读模式与全站文案，保存后立即写入 D1。</p>
        </div>
      </div>

      <div class="settings-grid">
        <article class="card settings-card">
          <div class="settings-head">
            <span class="settings-icon is-orange"><AppIcon name="idcard" /></span>
            <div><strong>演示账号</strong><span>{{ data.settings.demoEmail }}</span></div>
          </div>

          <label class="setting-row">
            <span>
              <strong>在登录页展示演示入口</strong>
              <em>关闭后登录页不再显示演示账号与密码，但手动输入仍可登录。</em>
            </span>
            <span class="switch">
              <input v-model="siteForm.demoVisible" type="checkbox" />
              <span class="track" />
              <span class="thumb" />
            </span>
          </label>

          <label class="setting-row">
            <span>
              <strong>演示账号只读</strong>
              <em>开启后，演示账号的所有写操作都会被服务端拒绝，只保留浏览、登录与授权。</em>
            </span>
            <span class="switch">
              <input v-model="siteForm.demoReadOnly" type="checkbox" />
              <span class="track" />
              <span class="thumb" />
            </span>
          </label>

          <div class="settings-cred">
            <span>演示凭据</span>
            <code>{{ data.settings.demoEmail }} · {{ data.settings.demoPassword }}</code>
          </div>
        </article>

        <article class="card settings-card">
          <div class="settings-head">
            <span class="settings-icon is-blue"><AppIcon name="message" /></span>
            <div><strong>站点公告</strong><span>同时显示在登录页与登录后的页面顶部</span></div>
          </div>

          <label class="setting-row">
            <span>
              <strong>启用站点公告</strong>
              <em>适合发布维护通知、活动提醒或重要变更。</em>
            </span>
            <span class="switch">
              <input v-model="siteForm.noticeEnabled" type="checkbox" />
              <span class="track" />
              <span class="thumb" />
            </span>
          </label>

          <div class="field">
            <label for="notice-text">公告内容</label>
            <textarea
              id="notice-text"
              v-model="siteForm.noticeText"
              class="input modal-textarea"
              rows="3"
              maxlength="200"
              placeholder="例如：今晚 23:00 进行星际网络维护，预计 30 分钟。"
            />
          </div>

          <div class="field">
            <label for="notice-level">公告级别</label>
            <select id="notice-level" v-model="siteForm.noticeLevel" class="input">
              <option value="info">信息 · 蓝色</option>
              <option value="success">完成 · 绿色</option>
              <option value="warn">提醒 · 橙色</option>
            </select>
          </div>
        </article>

        <article class="card settings-card settings-card-wide">
          <div class="settings-head">
            <span class="settings-icon is-purple"><AppIcon name="pen" /></span>
            <div><strong>页面文案</strong><span>自定义登录页欢迎语与全站页脚</span></div>
          </div>

          <div class="settings-fields">
            <div class="field">
              <label for="login-welcome">登录页欢迎语</label>
              <input id="login-welcome" v-model="siteForm.loginWelcome" class="input" maxlength="120" placeholder="使用你的 INU 星际档案继续旅程。" />
            </div>
            <div class="field">
              <label for="footer-text">页脚文案</label>
              <input id="footer-text" v-model="siteForm.footerText" class="input" maxlength="120" placeholder="© 2026 INU 无限宇宙 · 星际通行证" />
            </div>
          </div>
        </article>

        <article class="card settings-card settings-card-wide">
          <div class="settings-head">
            <span class="settings-icon is-green"><AppIcon name="grid" /></span>
            <div><strong>功能开关</strong><span>关闭后前端入口隐藏，服务端也会拒绝对应写操作</span></div>
          </div>

          <div class="feature-grid">
            <label
              v-for="item in [
                { key: 'featureRecharge', title: '星能充值', desc: '钱包充值入口与支付订单' },
                { key: 'featureWithdraw', title: '星能提现', desc: '提交提现申请并进入人工复核' },
                { key: 'featureSupply', title: '星际补给站', desc: '商品兑换、订单与物流' },
                { key: 'featureAgreements', title: '星际法条库', desc: '协议签署、查看与导出' },
                { key: 'featureVerification', title: '实名认证', desc: '星际公民认证入口与核验通道' },
                { key: 'featureAvatar', title: '头像自定义', desc: '修改头像文字与配色' },
                { key: 'featurePhoneBind', title: '手机绑定', desc: '绑定 / 更换安全手机' },
                { key: 'featureEmailChange', title: '邮箱更换', desc: '更换安全邮箱' },
                { key: 'featureRegister', title: '开放注册', desc: '允许新用户自助注册通行证' },
              ]"
              :key="item.key"
              class="setting-row feature-row"
            >
              <span>
                <strong>{{ item.title }}</strong>
                <em>{{ item.desc }}</em>
              </span>
              <span class="switch">
                <input v-model="siteForm[item.key]" type="checkbox" />
                <span class="track" />
                <span class="thumb" />
              </span>
            </label>
          </div>
        </article>

        <article class="card settings-card">
          <div class="settings-head">
            <span class="settings-icon is-purple"><AppIcon name="star" /></span>
            <div><strong>支付与验证</strong><span>充值、提现与验证码通道</span></div>
          </div>

          <div class="field">
            <label for="payment-mode">支付模式</label>
            <select id="payment-mode" v-model="siteForm.paymentMode" class="input">
              <option value="mock">模拟支付 · 下单即到账</option>
              <option value="off">关闭支付</option>
            </select>
          </div>

          <div class="field">
            <label for="verify-mode">验证码通道</label>
            <select id="verify-mode" v-model="siteForm.verificationMode" class="input">
              <option value="console">控制台调试 · 返回 devCode 并开放模拟认证</option>
              <option value="off">关闭验证码与模拟认证</option>
            </select>
            <p class="hint">关闭后手机 / 邮箱验证码与星际公民自助认证都不可用；「实名认证」功能开关关闭时，认证入口显示为暂未开放。</p>
          </div>

          <div class="field">
            <label for="recharge-presets">充值快捷金额（元）</label>
            <input id="recharge-presets" v-model="siteForm.rechargePresets" class="input" placeholder="50,100,200,500,1000" />
            <p class="hint">1–8 个金额，用英文逗号分隔，仅影响前端快捷选项。</p>
          </div>

          <div class="settings-fields">
            <div class="field">
              <label for="withdraw-min">提现门槛（星能）</label>
              <input id="withdraw-min" v-model.number="siteForm.withdrawMinYuan" class="input" type="number" min="10" max="50000" />
            </div>
            <div class="field">
              <label for="name-days">昵称修改间隔（天）</label>
              <input id="name-days" v-model.number="siteForm.nameChangeDays" class="input" type="number" min="0" max="365" />
            </div>
          </div>
        </article>

        <article class="card settings-card">
          <div class="settings-head">
            <span class="settings-icon is-cyan"><AppIcon name="mail" /></span>
            <div><strong>客服与钱包</strong><span>帮助终端邮箱与钱包卡面尾号</span></div>
          </div>

          <div class="field">
            <label for="support-email">客服邮箱</label>
            <input id="support-email" v-model="siteForm.supportEmail" class="input" type="email" placeholder="support@inu.space" />
            <p class="hint">用于帮助终端、补给站与安全中心的客服入口。</p>
          </div>

          <div class="field">
            <label for="wallet-last4">钱包尾号</label>
            <input id="wallet-last4" v-model="siteForm.walletCardLast4" class="input" maxlength="4" placeholder="0721" />
          </div>
        </article>

        <article class="card settings-card settings-card-wide">
          <div class="settings-head">
            <span class="settings-icon is-orange"><AppIcon name="lock" /></span>
            <div><strong>维护模式</strong><span>开启后普通用户无法执行写操作，超级管理员不受影响</span></div>
          </div>

          <label class="setting-row">
            <span>
              <strong>启用维护模式</strong>
              <em>登录、注册、浏览、健康检查与 OAuth 授权仍然可用。</em>
            </span>
            <span class="switch">
              <input v-model="siteForm.maintenanceEnabled" type="checkbox" />
              <span class="track" />
              <span class="thumb" />
            </span>
          </label>

          <div class="field">
            <label for="maintenance-text">维护提示</label>
            <textarea
              id="maintenance-text"
              v-model="siteForm.maintenanceText"
              class="input modal-textarea"
              rows="2"
              maxlength="200"
              placeholder="例如：星际网络正在升级，预计 30 分钟后恢复。"
            />
          </div>
        </article>
      </div>

      <div class="settings-foot">
        <p class="hint">保存后写入 D1：新的登录页立即生效；已登录页面刷新后同步最新公告与页脚。</p>
        <button class="btn btn-primary" type="button" :disabled="siteForm.saving" @click="saveSiteSettings">
          <span v-if="siteForm.saving" class="spinner" />
          <span>{{ siteForm.saving ? '保存中…' : '保存站点设置' }}</span>
        </button>
      </div>
    </section>

    <!-- 内容与商品 -->
    <section v-if="tab === 'content'" class="admin-section">
      <div class="admin-section-head">
        <div>
          <h2>内容与商品</h2>
          <p>补给商品、协议模板与站内信广播，全部写入 D1 并立即生效。</p>
        </div>
      </div>

      <div class="card broadcast-card">
        <div class="card-head">
          <h2>发送站内信</h2>
          <span class="badge badge-blue">全员 / 指定用户</span>
        </div>
        <div class="broadcast-grid">
          <div class="field">
            <label for="bc-title">消息标题</label>
            <input id="bc-title" v-model="broadcastForm.title" class="input" maxlength="40" placeholder="例如：星际电台今晚更新" />
          </div>
          <div class="field">
            <label for="bc-category">消息分类</label>
            <select id="bc-category" v-model="broadcastForm.category" class="input">
              <option v-for="item in NOTIFICATION_CATEGORIES" :key="item.key" :value="item.key">{{ item.label }}</option>
            </select>
          </div>
          <div class="field">
            <label for="bc-email">指定用户邮箱（可选）</label>
            <input id="bc-email" v-model="broadcastForm.email" class="input" placeholder="留空表示发送给全部用户" />
          </div>
          <div class="field">
            <label for="bc-link">跳转路径（可选）</label>
            <input id="bc-link" v-model="broadcastForm.link" class="input" maxlength="200" placeholder="/wallet" />
          </div>
          <div class="field broadcast-body">
            <label for="bc-body">正文</label>
            <textarea id="bc-body" v-model="broadcastForm.body" class="input modal-textarea" rows="3" maxlength="300" placeholder="最多 300 个字符" />
          </div>
        </div>
        <div class="broadcast-foot">
          <p class="hint">发送后用户可在「站内信」与通知中心查看，并受分类偏好开关影响。</p>
          <button class="btn btn-primary" type="button" :disabled="broadcastForm.sending" @click="sendBroadcast">
            <span v-if="broadcastForm.sending" class="spinner" />
            <span>{{ broadcastForm.sending ? '发送中…' : '发送站内信' }}</span>
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h2>补给商品</h2>
          <div class="head-actions">
            <span class="head-note">{{ productList.length }} 件</span>
            <button class="btn btn-primary btn-sm" type="button" @click="openCreateProduct">
              <AppIcon name="plus" />
              <span>新增商品</span>
            </button>
          </div>
        </div>

        <div v-if="!productList.length" class="admin-empty compact">
          <span class="admin-empty-icon"><AppIcon name="box" /></span>
          <h3>还没有补给商品</h3>
          <p>新增商品后，已认证的星际公民即可在补给站兑换。</p>
        </div>

        <div v-else class="manage-list">
          <div v-for="product in productList" :key="product.id" class="manage-row">
            <span class="manage-mark" :class="`is-${product.tone}`">
              <AppIcon :name="bareIcon(product.icon)" />
            </span>
            <div class="manage-copy">
              <strong>
                {{ product.name }}
                <span class="badge" :class="product.active ? 'badge-green' : 'badge-gray'">{{ product.active ? '上架' : '下架' }}</span>
                <span v-if="product.tag" class="badge badge-blue">{{ product.tag }}</span>
              </strong>
              <span>{{ product.desc || '暂无描述' }}</span>
              <em>{{ product.id }} · 排序 {{ product.sort }} · 库存 {{ stockLabel(product.stock) }}</em>
            </div>
            <div class="manage-price">
              <strong>{{ money(product.priceCents) }}</strong>
              <span>星能</span>
            </div>
            <div class="manage-actions">
              <button class="btn btn-ghost btn-sm" type="button" @click="openEditProduct(product)">编辑</button>
              <button class="btn btn-danger btn-sm" type="button" @click="deleteProduct(product)">删除</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h2>协议模板</h2>
          <div class="head-actions">
            <span class="head-note">{{ templateList.length }} 份</span>
            <button class="btn btn-primary btn-sm" type="button" @click="openCreateTemplate">
              <AppIcon name="plus" />
              <span>新增协议</span>
            </button>
          </div>
        </div>

        <div v-if="!templateList.length" class="admin-empty compact">
          <span class="admin-empty-icon"><AppIcon name="file" /></span>
          <h3>还没有协议模板</h3>
          <p>新增模板后会自动为全部用户生成待签署记录。</p>
        </div>

        <div v-else class="manage-list">
          <div v-for="template in templateList" :key="template.id" class="manage-row">
            <span class="manage-mark is-purple"><AppIcon name="file" /></span>
            <div class="manage-copy">
              <strong>
                {{ template.title }}
                <span class="badge" :class="template.active ? 'badge-green' : 'badge-gray'">{{ template.active ? '生效中' : '已下架' }}</span>
              </strong>
              <span>{{ template.version }} · 签署奖励 {{ template.reward }} 粒子 · 排序 {{ template.sort }}</span>
              <em>{{ (template.content || '').slice(0, 48) }}{{ (template.content || '').length > 48 ? '…' : '' }}</em>
            </div>
            <div class="manage-actions">
              <button class="btn btn-ghost btn-sm" type="button" @click="openEditTemplate(template)">编辑</button>
              <button class="btn btn-danger btn-sm" type="button" @click="deleteTemplate(template)">删除</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 财务与订单 -->
    <section v-if="tab === 'finance'" class="admin-section">
      <div class="admin-section-head">
        <div>
          <h2>财务与订单</h2>
          <p>用户星能、充值、补给订单与提现复核，所有金额以星能计。</p>
        </div>
      </div>

      <div class="finance-grid">
        <div class="admin-stat">
          <span class="admin-stat-icon is-blue"><AppIcon name="idcard" /></span>
          <div><strong>{{ money(finance.walletCents) }}</strong><span>用户星能总额</span></div>
        </div>
        <div class="admin-stat">
          <span class="admin-stat-icon is-green"><AppIcon name="star" /></span>
          <div><strong>{{ money(finance.rechargeCents) }}</strong><span>累计充值（{{ finance.rechargeCount || 0 }} 笔）</span></div>
        </div>
        <div class="admin-stat">
          <span class="admin-stat-icon is-purple"><AppIcon name="box" /></span>
          <div><strong>{{ money(finance.supplyCents) }}</strong><span>补给消费（{{ finance.orderCount || 0 }} 单）</span></div>
        </div>
        <div class="admin-stat">
          <span class="admin-stat-icon is-orange"><AppIcon name="clock" /></span>
          <div><strong>{{ money(finance.withdrawPendingCents) }}</strong><span>待复核提现（{{ finance.withdrawPendingCount || 0 }} 笔）</span></div>
        </div>
        <div class="admin-stat">
          <span class="admin-stat-icon is-cyan"><AppIcon name="check" /></span>
          <div><strong>{{ money(finance.withdrawnCents) }}</strong><span>已打款提现</span></div>
        </div>
        <div class="admin-stat">
          <span class="admin-stat-icon is-blue"><AppIcon name="file" /></span>
          <div><strong>{{ finance.agreementSigned || 0 }} / {{ finance.agreementTotal || 0 }}</strong><span>协议已签署</span></div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h2>提现复核</h2>
          <span class="head-note">{{ finance.withdrawPendingCount || 0 }} 笔待处理</span>
        </div>

        <div v-if="!withdrawalList.length" class="admin-empty compact">
          <span class="admin-empty-icon"><AppIcon name="idcard" /></span>
          <h3>还没有提现申请</h3>
          <p>用户提交提现后，会在这里进入人工复核。</p>
        </div>

        <div v-else class="manage-list">
          <div v-for="row in withdrawalList" :key="row.id" class="manage-row">
            <span class="manage-mark is-orange"><AppIcon name="idcard" /></span>
            <div class="manage-copy">
              <strong>
                {{ money(row.amountCents) }} 星能
                <span class="badge" :class="WITHDRAW_STATUS[row.status]?.tone || 'badge-gray'">{{ WITHDRAW_STATUS[row.status]?.label || row.status }}</span>
              </strong>
              <span>{{ row.userName }} · {{ row.userEmail }}</span>
              <em>{{ row.code }} · 收款账号 {{ row.account }} · {{ dateTimeLabel(row.createdAt) }}</em>
            </div>
            <div class="manage-actions">
              <button v-if="row.status === 'processing'" class="btn btn-primary btn-sm" type="button" @click="openWithdraw(row)">处理</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h2>补给订单</h2>
          <span class="head-note">最近 20 笔</span>
        </div>

        <div v-if="!orderList.length" class="admin-empty compact">
          <span class="admin-empty-icon"><AppIcon name="box" /></span>
          <h3>还没有补给订单</h3>
          <p>用户在补给站兑换商品后，订单会出现在这里。</p>
        </div>

        <div v-else class="manage-list">
          <div v-for="order in orderList" :key="order.id" class="manage-row">
            <span class="manage-mark is-blue"><AppIcon name="box" /></span>
            <div class="manage-copy">
              <strong>
                {{ order.item }}
                <span class="badge" :class="ORDER_STATUS_TONES[order.status] || 'badge-gray'">{{ orderStatusLabel(order.status) }}</span>
              </strong>
              <span>{{ order.userName }} · {{ order.code }}</span>
              <em>{{ money(order.energyCents) }} 星能 · {{ dateTimeLabel(order.createdAt) }}{{ order.trackingNo ? ` · ${order.carrier || '星际快递'} ${order.trackingNo}` : '' }}</em>
            </div>
            <div class="manage-actions">
              <button class="btn btn-ghost btn-sm" type="button" @click="openOrderAdmin(order)">处理</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h2>充值订单</h2>
          <span class="head-note">最近 20 笔</span>
        </div>

        <div v-if="!rechargeList.length" class="admin-empty compact">
          <span class="admin-empty-icon"><AppIcon name="star" /></span>
          <h3>还没有充值记录</h3>
          <p>用户创建充值订单后，会在这里展示支付状态。</p>
        </div>

        <div v-else class="manage-list">
          <div v-for="row in rechargeList" :key="row.id" class="manage-row">
            <span class="manage-mark is-green"><AppIcon name="star" /></span>
            <div class="manage-copy">
              <strong>
                {{ money(row.amountCents) }} 星能
                <span class="badge" :class="row.status === 'paid' ? 'badge-green' : 'badge-orange'">{{ row.status === 'paid' ? '已到账' : row.status === 'pending' ? '待支付' : row.status }}</span>
              </strong>
              <span>{{ row.userName }} · {{ row.userEmail }}</span>
              <em>{{ row.code }} · {{ row.method || 'mock' }} · {{ dateTimeLabel(row.createdAt) }}</em>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 用户管理 -->
    <section v-if="tab === 'users'" class="admin-section">
      <div class="admin-section-head">
        <div>
          <h2>用户管理</h2>
          <p>搜索用户、调整昵称、认证状态、INU 粒子与星能余额，所有调整都会写入流水与审计。</p>
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
              <button class="btn btn-ghost btn-sm" type="button" @click="resolveResetRequest(row)">标记已处理</button>
            </div>
          </div>
        </div>
        <p class="hint">在用户调整弹窗中填写新密码并保存后，该用户的找回申请会自动完成。</p>
      </div>

      <div class="card">
        <div class="user-search">
          <input
            v-model="userQuery"
            class="input"
            placeholder="搜索邮箱 / 昵称 / INU ID / 手机号"
            @keyup.enter="searchAdminUsers"
          />
          <button class="btn btn-primary" type="button" :disabled="usersLoading" @click="searchAdminUsers">
            <span v-if="usersLoading" class="spinner" />
            <span>{{ usersLoading ? '搜索中…' : '搜索用户' }}</span>
          </button>
        </div>

        <div v-if="!adminUsers.length" class="admin-empty compact">
          <span class="admin-empty-icon"><AppIcon name="user" /></span>
          <h3>没有匹配的用户</h3>
          <p>试试其他关键词，或清空搜索查看最近注册的星际公民。</p>
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
              <em>{{ money(user.balanceCents) }} 星能 · {{ user.particles }} 粒子 · {{ user.phone || '未绑定手机' }} · {{ dateTimeLabel(user.createdAt) }}</em>
            </div>
            <div class="manage-actions">
              <button class="btn btn-ghost btn-sm" type="button" @click="openUserAdjust(user)">调整</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 应用接入 -->
    <section v-if="tab === 'clients'" class="admin-section">
      <div class="admin-section-head">
        <div>
          <h2>OAuth 应用</h2>
          <p>第三方应用通过这些 client 让用户使用 INU 账号登录。</p>
        </div>
        <button class="btn btn-primary" type="button" @click="openCreateClient">
          <AppIcon name="plus" />
          <span>创建应用</span>
        </button>
      </div>

      <div v-if="!clients.length" class="card admin-empty">
        <span class="admin-empty-icon"><AppIcon name="plug" /></span>
        <h3>还没有接入应用</h3>
        <p>创建一个 OAuth client，把 Client ID 和回调地址交给第三方应用即可开始接入。</p>
        <button class="btn btn-primary btn-sm" type="button" @click="openCreateClient">创建第一个应用</button>
      </div>

      <div v-else class="client-list">
        <article v-for="client in clients" :key="client.id" class="card client-card">
          <div class="client-head">
            <span class="client-mark">{{ (client.name || 'A').slice(0, 1) }}</span>
            <div class="client-title">
              <strong>{{ client.name }}</strong>
              <span v-if="client.description">{{ client.description }}</span>
              <span v-else class="muted">暂无应用描述</span>
            </div>
            <div class="client-badges">
              <span class="badge" :class="client.isPublic ? 'badge-orange' : 'badge-purple'">
                {{ client.isPublic ? '公开客户端' : '机密客户端' }}
              </span>
              <span class="badge" :class="client.enabled ? 'badge-green' : 'badge-gray'">
                {{ client.enabled ? '启用中' : '已停用' }}
              </span>
            </div>
            <label class="switch" :aria-label="`启用 ${client.name}`">
              <input type="checkbox" :checked="client.enabled" @change="toggleClient(client, $event)" />
              <span class="track" />
              <span class="thumb" />
            </label>
          </div>

          <div class="client-grid">
            <div class="client-cell">
              <span>Client ID</span>
              <div class="copy-line">
                <code>{{ client.clientId }}</code>
                <button class="icon-btn copy-btn" type="button" aria-label="复制 Client ID" @click="copyText(client.clientId, 'Client ID 已复制')">
                  <AppIcon name="copy" />
                </button>
              </div>
            </div>
            <div class="client-cell">
              <span>权限范围</span>
              <p>{{ client.scopes.map(scopeLabel).join(' · ') }}</p>
            </div>
            <div class="client-cell client-cell-wide">
              <span>回调地址</span>
              <code v-for="uri in client.redirectUris" :key="uri" class="client-uri">{{ uri }}</code>
            </div>
            <div class="client-cell">
              <span>最近使用</span>
              <p>{{ client.lastUsedAt ? timeLabel(client.lastUsedAt) : '尚未使用' }}</p>
            </div>
            <div class="client-cell">
              <span>创建时间</span>
              <p>{{ timeLabel(client.createdAt) }}</p>
            </div>
          </div>

          <div class="client-actions">
            <button class="btn btn-ghost btn-sm" type="button" @click="openEditClient(client)">编辑</button>
            <button v-if="!client.isPublic" class="btn btn-ghost btn-sm" type="button" @click="rotateSecret(client)">重置密钥</button>
            <button class="btn btn-danger btn-sm" type="button" @click="deleteClient(client)">删除</button>
          </div>
        </article>
      </div>
    </section>

    <!-- 接入指引 -->
    <section v-if="tab === 'access'" class="admin-section">
      <div class="card doc-card">
        <span class="doc-card-mark"><AppIcon name="file" /></span>
        <div class="doc-card-copy">
          <strong>AI 接入文档</strong>
          <p>端点、PKCE 流程、令牌交换、错误处理与安全检查已整理成 Markdown，下载后可直接交给其他项目的 AI 执行接入。</p>
        </div>
        <div class="doc-card-actions">
          <button class="btn btn-primary btn-sm" type="button" @click="downloadIntegrationDoc">
            <AppIcon name="file" />
            <span>下载 MD</span>
          </button>
          <button class="btn btn-ghost btn-sm" type="button" @click="copyIntegrationDoc">复制全文</button>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h2>OAuth 2.0 接入端点</h2>
          <span class="badge badge-blue">Authorization Code</span>
        </div>
        <div class="endpoint-list">
          <div v-for="item in [
            { key: 'authorization', label: '授权地址', hint: '引导用户打开，完成登录与授权' },
            { key: 'token', label: 'Token 地址', hint: '服务端使用 code 换取 access_token' },
            { key: 'userinfo', label: '用户信息', hint: '携带 Bearer Token 获取用户资料' },
            { key: 'revocation', label: '撤销令牌', hint: '用户退出应用时撤销 access_token' },
            { key: 'discovery', label: '发现文档', hint: 'OAuth 2.0 授权服务器元数据' },
          ]" :key="item.key" class="endpoint-row">
            <div class="endpoint-copy">
              <strong>{{ item.label }}</strong>
              <span>{{ item.hint }}</span>
            </div>
            <div class="copy-line endpoint-value">
              <code>{{ endpoints[item.key] }}</code>
              <button class="icon-btn copy-btn" type="button" :aria-label="`复制${item.label}`" @click="copyText(endpoints[item.key], `${item.label}已复制`)">
                <AppIcon name="copy" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="access-grid">
        <div class="card">
          <h2 class="access-title">接入步骤</h2>
          <ol class="access-steps">
            <li><span>01</span><div><strong>创建应用</strong><p>登记应用名称与回调地址，获得 Client ID 与 Client Secret。</p></div></li>
            <li><span>02</span><div><strong>引导授权</strong><p>把用户跳转到授权地址，state 必须随机生成并在回调时校验。</p></div></li>
            <li><span>03</span><div><strong>换取令牌</strong><p>回调拿到 code 后，在服务端调用 Token 地址换取 access_token。</p></div></li>
            <li><span>04</span><div><strong>读取资料</strong><p>使用 Bearer Token 调用用户信息接口，完成登录或账号绑定。</p></div></li>
          </ol>
        </div>

        <div class="card">
          <h2 class="access-title">权限范围</h2>
          <div class="scope-list">
            <div v-for="scope in scopes" :key="scope.key" class="scope-row">
              <span class="scope-key">{{ scope.key }}</span>
              <div><strong>{{ scope.label }}</strong><p>{{ scope.description }}</p></div>
            </div>
          </div>
          <div class="access-note">
            <AppIcon name="shield" />
            <p>机密客户端使用 client_secret 认证；公开客户端必须使用 PKCE（S256），且不保存密钥。</p>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h2>最小接入示例</h2>
          <span class="head-note">服务端伪代码</span>
        </div>
        <pre class="access-code"><code>// 1. 引导用户授权
const url = new URL(endpoints.authorization);
url.searchParams.set('response_type', 'code');
url.searchParams.set('client_id', CLIENT_ID);
url.searchParams.set('redirect_uri', CALLBACK_URL);
url.searchParams.set('scope', 'profile email');
url.searchParams.set('state', randomState);

// 2. 回调后换取令牌
const res = await fetch(endpoints.token, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    redirect_uri: CALLBACK_URL,
  }),
});
const { access_token } = await res.json();

// 3. 读取用户资料
const profile = await fetch(endpoints.userinfo, {
  headers: { Authorization: `Bearer ${access_token}` },
}).then((r) =&gt; r.json());</code></pre>
      </div>
    </section>

    <!-- 审计日志 -->
    <section v-if="tab === 'audit'" class="admin-section">
      <div class="card">
        <div class="card-head">
          <h2>管理操作审计</h2>
          <span class="head-note">最近 20 条</span>
        </div>
        <div v-if="!audit.length" class="admin-empty compact">
          <span class="admin-empty-icon"><AppIcon name="clock" /></span>
          <h3>还没有管理操作</h3>
          <p>配置登录方式、创建应用或调整管理员后，记录会出现在这里。</p>
        </div>
        <div v-else class="audit-list">
          <div v-for="log in audit" :key="log.id" class="audit-row">
            <span class="audit-dot" />
            <div class="audit-copy">
              <strong>{{ log.action }}</strong>
              <span>{{ log.detail }}</span>
            </div>
            <div class="audit-meta">
              <span>{{ log.adminName }}</span>
              <em>{{ dateTimeLabel(log.createdAt) }}</em>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 管理员 -->
    <section v-if="tab === 'admins'" class="admin-section">
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

  <!-- 创建 / 编辑应用 -->
  <BaseModal v-model="clientModal" :title="editingClient ? '编辑 OAuth 应用' : '创建 OAuth 应用'" width="560px">
    <div class="modal-form">
      <div class="field">
        <label for="client-name">应用名称</label>
        <input id="client-name" v-model="clientForm.name" class="input" maxlength="40" placeholder="例如：星环笔记" />
      </div>
      <div class="field">
        <label for="client-desc">应用描述</label>
        <input id="client-desc" v-model="clientForm.description" class="input" maxlength="200" placeholder="一句话介绍这个应用" />
      </div>
      <div class="field">
        <label for="client-home">应用主页</label>
        <input id="client-home" v-model="clientForm.homepageUrl" class="input" placeholder="https://example.com" />
      </div>
      <div class="field">
        <label for="client-redirects">回调地址</label>
        <textarea id="client-redirects" v-model="clientForm.redirectUris" class="input modal-textarea" rows="4" placeholder="每行一个，例如：&#10;https://example.com/auth/inu/callback" />
        <p class="hint">必须与应用发起授权时使用的 redirect_uri 完全一致；仅支持 https，localhost 可使用 http。</p>
      </div>
      <div class="field">
        <label>权限范围</label>
        <div class="scope-picker">
          <button
            v-for="scope in scopes"
            :key="scope.key"
            type="button"
            class="scope-option"
            :class="{ active: clientForm.scopes.includes(scope.key) }"
            @click="toggleScope(scope.key)"
          >
            <AppIcon :name="clientForm.scopes.includes(scope.key) ? 'check' : 'plus'" />
            <span><strong>{{ scope.label }}</strong><em>{{ scope.key }}</em></span>
          </button>
        </div>
      </div>
      <label v-if="!editingClient" class="public-toggle">
        <span class="switch">
          <input v-model="clientForm.isPublic" type="checkbox" />
          <span class="track" />
          <span class="thumb" />
        </span>
        <span><strong>公开客户端</strong><em>无 Client Secret，强制使用 PKCE（S256），适合 SPA / 移动应用</em></span>
      </label>
      <p v-else class="hint">应用类型：{{ editingClient.isPublic ? '公开客户端（PKCE）' : '机密客户端（Client Secret）' }}，创建后不可修改。</p>
      <p v-if="clientError" class="modal-error">{{ clientError }}</p>
    </div>
    <template #footer>
      <button class="btn btn-ghost" type="button" @click="clientModal = false">取消</button>
      <button class="btn btn-primary" type="button" :disabled="savingClient" @click="submitClient">
        <span v-if="savingClient" class="spinner" />
        <span>{{ savingClient ? '保存中…' : editingClient ? '保存修改' : '创建应用' }}</span>
      </button>
    </template>
  </BaseModal>

  <!-- Client Secret 仅显示一次 -->
  <BaseModal v-model="secretModal" title="Client Secret" width="500px">
    <div class="secret-alert">
      <AppIcon name="lock" />
      <p>请立即把密钥保存到 {{ secretClientName }} 的配置中。关闭后无法再次查看，只能重新生成。</p>
    </div>
    <div class="secret-box">
      <code>{{ secretValue }}</code>
      <button class="icon-btn copy-btn" type="button" aria-label="复制 Client Secret" @click="copyText(secretValue, 'Client Secret 已复制')">
        <AppIcon name="copy" />
      </button>
    </div>
    <template #footer>
      <button class="btn btn-primary" type="button" @click="secretModal = false">我已安全保存</button>
    </template>
  </BaseModal>

  <!-- 商品编辑 -->
  <BaseModal v-model="productModal" :title="editingProduct ? '编辑补给商品' : '新增补给商品'" width="560px">
    <div class="modal-form">
      <div class="settings-fields">
        <div class="field">
          <label for="product-name">商品名称</label>
          <input id="product-name" v-model="productForm.name" class="input" maxlength="40" placeholder="例如：星尘补给包" />
        </div>
        <div class="field">
          <label for="product-price">价格（星能）</label>
          <input id="product-price" v-model="productForm.priceYuan" class="input" type="number" min="1" step="0.01" />
        </div>
      </div>
      <div class="field">
        <label for="product-desc">商品描述</label>
        <input id="product-desc" v-model="productForm.desc" class="input" maxlength="160" placeholder="一句话介绍这件补给" />
      </div>
      <div class="settings-fields">
        <div class="field">
          <label for="product-icon">图标</label>
          <select id="product-icon" v-model="productForm.icon" class="input">
            <option v-for="icon in PRODUCT_ICONS" :key="icon" :value="icon">{{ icon }}</option>
          </select>
        </div>
        <div class="field">
          <label for="product-tone">配色</label>
          <select id="product-tone" v-model="productForm.tone" class="input">
            <option v-for="tone in TONES" :key="tone" :value="tone">{{ tone }}</option>
          </select>
        </div>
      </div>
      <div class="settings-fields">
        <div class="field">
          <label for="product-tag">标签</label>
          <input id="product-tag" v-model="productForm.tag" class="input" maxlength="12" placeholder="例如：限定" />
        </div>
        <div class="field">
          <label for="product-id">商品 ID</label>
          <input
            id="product-id"
            v-model="productForm.id"
            class="input"
            :disabled="Boolean(editingProduct)"
            maxlength="40"
            placeholder="留空自动生成"
          />
        </div>
      </div>
      <div class="settings-fields">
        <div class="field">
          <label for="product-stock">库存（-1 表示不限）</label>
          <input id="product-stock" v-model.number="productForm.stock" class="input" type="number" min="-1" max="99999" />
        </div>
        <div class="field">
          <label for="product-sort">排序值</label>
          <input id="product-sort" v-model.number="productForm.sort" class="input" type="number" min="0" max="9999" />
        </div>
      </div>
      <label class="public-toggle">
        <span class="switch">
          <input v-model="productForm.active" type="checkbox" />
          <span class="track" />
          <span class="thumb" />
        </span>
        <span><strong>立即上架</strong><em>关闭后商品保留在后台，但补给站不再展示</em></span>
      </label>
      <p v-if="productError" class="modal-error">{{ productError }}</p>
    </div>
    <template #footer>
      <button class="btn btn-ghost" type="button" @click="productModal = false">取消</button>
      <button class="btn btn-primary" type="button" :disabled="savingProduct" @click="submitProduct">
        <span v-if="savingProduct" class="spinner" />
        <span>{{ savingProduct ? '保存中…' : editingProduct ? '保存修改' : '创建商品' }}</span>
      </button>
    </template>
  </BaseModal>

  <!-- 协议模板编辑 -->
  <BaseModal v-model="templateModal" :title="editingTemplate ? '编辑协议模板' : '新增协议模板'" width="640px">
    <div class="modal-form">
      <div class="settings-fields">
        <div class="field">
          <label for="template-title">协议名称</label>
          <input id="template-title" v-model="templateForm.title" class="input" maxlength="40" placeholder="例如：星际航行服务协议" />
        </div>
        <div class="field">
          <label for="template-version">版本号</label>
          <input id="template-version" v-model="templateForm.version" class="input" maxlength="20" placeholder="v1.0" />
        </div>
      </div>
      <div class="settings-fields">
        <div class="field">
          <label for="template-reward">签署奖励（粒子）</label>
          <input id="template-reward" v-model.number="templateForm.reward" class="input" type="number" min="0" max="10000" />
        </div>
        <div class="field">
          <label for="template-sort">排序值</label>
          <input id="template-sort" v-model.number="templateForm.sort" class="input" type="number" min="0" max="9999" />
        </div>
      </div>
      <div class="field">
        <label for="template-content">协议正文（Markdown / 纯文本）</label>
        <textarea id="template-content" v-model="templateForm.content" class="input modal-textarea" rows="10" maxlength="20000" placeholder="填写协议条款，支持换行与 Markdown。" />
        <p class="hint">保存后会同步更新所有待签署记录；重新启用时会为全部用户补齐待签。</p>
      </div>
      <label class="public-toggle">
        <span class="switch">
          <input v-model="templateForm.active" type="checkbox" />
          <span class="track" />
          <span class="thumb" />
        </span>
        <span><strong>生效中</strong><em>下架后用户仍可查看已签署版本，但不再收到新的待签提醒</em></span>
      </label>
      <p v-if="templateError" class="modal-error">{{ templateError }}</p>
    </div>
    <template #footer>
      <button class="btn btn-ghost" type="button" @click="templateModal = false">取消</button>
      <button class="btn btn-primary" type="button" :disabled="savingTemplate" @click="submitTemplate">
        <span v-if="savingTemplate" class="spinner" />
        <span>{{ savingTemplate ? '保存中…' : editingTemplate ? '保存修改' : '创建模板' }}</span>
      </button>
    </template>
  </BaseModal>

  <!-- 订单处理 -->
  <BaseModal v-model="orderModal" title="处理补给订单" width="520px">
    <div v-if="orderTarget" class="modal-form">
      <div class="modal-summary">
        <strong>{{ orderTarget.item }}</strong>
        <span>{{ orderTarget.code }} · {{ orderTarget.userName }} · {{ money(orderTarget.energyCents) }} 星能</span>
      </div>
      <div class="field">
        <label for="order-status">订单状态</label>
        <select id="order-status" v-model="orderForm.status" class="input">
          <option v-for="item in ORDER_STATUS_OPTIONS" :key="item.key" :value="item.key">{{ item.label }}</option>
        </select>
        <p class="hint">取消已支付订单会自动把星能退回用户钱包；标记签收会通知用户。</p>
      </div>
      <div class="settings-fields">
        <div class="field">
          <label for="order-carrier">承运方</label>
          <input id="order-carrier" v-model="orderForm.carrier" class="input" maxlength="30" placeholder="例如：星际快递" />
        </div>
        <div class="field">
          <label for="order-tracking">运单号</label>
          <input id="order-tracking" v-model="orderForm.trackingNo" class="input" maxlength="60" placeholder="填写后通知用户物流更新" />
        </div>
      </div>
      <p v-if="orderError" class="modal-error">{{ orderError }}</p>
    </div>
    <template #footer>
      <button class="btn btn-ghost" type="button" @click="orderModal = false">取消</button>
      <button class="btn btn-primary" type="button" :disabled="savingOrder" @click="submitOrder">
        <span v-if="savingOrder" class="spinner" />
        <span>{{ savingOrder ? '保存中…' : '保存订单状态' }}</span>
      </button>
    </template>
  </BaseModal>

  <!-- 提现复核 -->
  <BaseModal v-model="withdrawModal" title="提现复核" width="500px">
    <div v-if="withdrawTarget" class="modal-form">
      <div class="modal-summary">
        <strong>{{ money(withdrawTarget.amountCents) }} 星能</strong>
        <span>{{ withdrawTarget.code }} · {{ withdrawTarget.userName }}</span>
        <span>收款账号：{{ withdrawTarget.account }}</span>
      </div>
      <div class="field">
        <label for="withdraw-note">复核备注（可选）</label>
        <textarea id="withdraw-note" v-model="withdrawNote" class="input modal-textarea" rows="3" maxlength="200" placeholder="驳回时建议填写原因，会随站内信发送给用户。" />
      </div>
      <div class="modal-note warn">
        <AppIcon name="shield" />
        <p>通过后会标记为已打款；驳回会立即把星能退回用户钱包，无法撤回。</p>
      </div>
    </div>
    <template #footer>
      <button class="btn btn-ghost" type="button" @click="withdrawModal = false">取消</button>
      <button class="btn btn-danger" type="button" :disabled="withdrawBusy" @click="processWithdraw('reject')">驳回并退款</button>
      <button class="btn btn-primary" type="button" :disabled="withdrawBusy" @click="processWithdraw('approve')">
        <span v-if="withdrawBusy" class="spinner" />
        <span>{{ withdrawBusy ? '处理中…' : '通过并打款' }}</span>
      </button>
    </template>
  </BaseModal>

  <!-- 用户调整 -->
  <BaseModal v-model="userModal" title="调整用户资料" width="520px">
    <div v-if="userTarget" class="modal-form">
      <div class="modal-summary">
        <strong>{{ userTarget.name }}</strong>
        <span>{{ userTarget.email }} · {{ userTarget.inuId }}</span>
        <span>当前 {{ money(userTarget.balanceCents) }} 星能 · {{ userTarget.particles }} 粒子</span>
      </div>
      <div class="field">
        <label for="user-name">昵称</label>
        <input id="user-name" v-model="userForm.name" class="input" maxlength="20" />
      </div>
      <label class="public-toggle">
        <span class="switch">
          <input v-model="userForm.verified" type="checkbox" />
          <span class="track" />
          <span class="thumb" />
        </span>
        <span><strong>星际公民认证</strong><em>开启后可下单、提现并使用全部功能</em></span>
      </label>
      <div class="field">
        <label for="user-password">重置登录密码</label>
        <input
          id="user-password"
          v-model="userForm.password"
          class="input"
          type="password"
          autocomplete="new-password"
          placeholder="留空表示不修改；至少 8 位且包含字母与数字"
        />
        <p class="hint">重置后用户需使用新密码登录，待处理的密码找回申请会自动完成。</p>
      </div>
      <div class="settings-fields">
        <div class="field">
          <label for="user-particles">粒子增减</label>
          <input id="user-particles" v-model.number="userForm.particlesDelta" class="input" type="number" placeholder="正数增加，负数扣减" />
        </div>
        <div class="field">
          <label for="user-balance">星能增减</label>
          <input id="user-balance" v-model.number="userForm.balanceDeltaYuan" class="input" type="number" step="0.01" placeholder="正数增加，负数扣减" />
        </div>
      </div>
      <p class="hint">粒子和星能的调整会写入用户流水与安全日志，并发送站内信。</p>
      <p v-if="userError" class="modal-error">{{ userError }}</p>
    </div>
    <template #footer>
      <button class="btn btn-ghost" type="button" @click="userModal = false">取消</button>
      <button class="btn btn-primary" type="button" :disabled="userSaving" @click="submitUserAdjust">
        <span v-if="userSaving" class="spinner" />
        <span>{{ userSaving ? '保存中…' : '保存调整' }}</span>
      </button>
    </template>
  </BaseModal>

  <!-- 通用确认 -->
  <BaseModal v-model="confirmState.open" :title="confirmState.title" width="440px">
    <p class="confirm-copy">{{ confirmState.message }}</p>
    <template #footer>
      <button class="btn btn-ghost" type="button" @click="confirmState.open = false">取消</button>
      <button class="btn" :class="confirmState.danger ? 'btn-danger' : 'btn-primary'" type="button" :disabled="confirmState.loading" @click="runConfirm">
        <span v-if="confirmState.loading" class="spinner" />
        <span>{{ confirmState.loading ? '处理中…' : confirmState.confirmText }}</span>
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.admin-banner{
  position:relative;overflow:hidden;display:flex;align-items:center;justify-content:space-between;
  gap:24px;padding:26px 28px;border-radius:20px;color:#fff;
  background:linear-gradient(120deg,#101b33 0%,#1a2b52 46%,#2c2a63 100%);
  border:1px solid rgba(255,255,255,.08);box-shadow:0 18px 46px rgba(8,20,48,.24);
  margin-bottom:18px;
}
.admin-banner::before{
  content:"";position:absolute;inset:0;pointer-events:none;
  background-image:radial-gradient(circle at 18% 30%,rgba(255,255,255,.38) 0 1px,transparent 1.6px),
    radial-gradient(circle at 72% 18%,rgba(255,255,255,.24) 0 1px,transparent 1.6px),
    radial-gradient(circle at 86% 72%,rgba(255,255,255,.3) 0 1px,transparent 1.6px);
  background-size:180px 180px,240px 240px,200px 200px;
}
.admin-banner-copy{position:relative;z-index:1;max-width:540px}
.admin-kicker{display:inline-flex;align-items:center;gap:8px;font-size:10.5px;letter-spacing:.22em;color:#8fb6ff}
.admin-kicker .pulse-dot{background:#55e0c0;box-shadow:0 0 0 4px rgba(85,224,192,.14)}
.admin-banner h2{font-size:22px;line-height:1.4;margin:12px 0 6px;letter-spacing:.01em}
.admin-banner p{font-size:13px;line-height:1.75;color:#b9c6de}
.admin-orbit{position:relative;width:150px;height:150px;flex:none;margin-right:12px}
.admin-ring{position:absolute;inset:0;border-radius:50%;border:1px solid rgba(143,182,255,.28)}
.admin-ring.ring-two{inset:24px;border-color:rgba(167,139,250,.34)}
.admin-core{
  position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
  width:52px;height:52px;border-radius:50%;display:grid;place-items:center;
  font-size:12px;font-weight:800;letter-spacing:.12em;
  background:linear-gradient(135deg,#165DFF,#8B5CF6);box-shadow:0 0 0 8px rgba(77,141,255,.1),0 10px 26px rgba(22,93,255,.42);
}
.admin-dot{position:absolute;width:8px;height:8px;border-radius:50%;background:#67e8f9;box-shadow:0 0 12px rgba(103,232,249,.9)}
.admin-dot.dot-one{top:12px;right:30px}
.admin-dot.dot-two{bottom:22px;left:20px;background:#c4b5fd;box-shadow:0 0 12px rgba(196,181,253,.9)}

.admin-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:20px}
.admin-stat{
  display:flex;align-items:center;gap:12px;padding:16px;border-radius:14px;
  background:var(--card);border:1px solid var(--card-border);box-shadow:var(--shadow-card);
}
.admin-stat-icon{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;flex:none}
.admin-stat-icon .icon{width:18px;height:18px}
.admin-stat-icon.is-blue{background:var(--primary-light);color:var(--primary)}
.admin-stat-icon.is-purple{background:rgba(139,92,246,.12);color:var(--accent)}
.admin-stat-icon.is-cyan{background:rgba(6,182,212,.12);color:var(--cyan)}
.admin-stat-icon.is-green{background:rgba(0,180,42,.1);color:var(--success)}
.admin-stat div{display:flex;flex-direction:column;line-height:1.25;min-width:0}
.admin-stat strong{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums}
.admin-stat span{font-size:12px;color:var(--text-mute);white-space:nowrap}
.admin-stat em{font-style:normal;font-size:10.5px;color:var(--text-mute);margin-left:auto;text-align:right;line-height:1.4}

.admin-tabs{
  display:flex;gap:4px;padding:5px;border-radius:12px;margin-bottom:20px;
  background:var(--soft);border:1px solid var(--border-soft);overflow-x:auto;
}
.admin-tab{
  display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 14px;border:none;border-radius:8px;
  background:transparent;color:var(--text-sub);font-size:13px;font-weight:500;white-space:nowrap;cursor:pointer;
  transition:background .18s,color .18s,box-shadow .18s;
}
.admin-tab .icon{width:16px;height:16px}
.admin-tab:hover{color:var(--text);background:var(--hover-soft)}
.admin-tab.active{background:var(--card);color:var(--primary);box-shadow:0 2px 10px rgba(15,42,92,.08);font-weight:600}

.admin-section{display:flex;flex-direction:column;gap:18px}
.badge-purple{background:rgba(139,92,246,.12);color:var(--accent)}
.admin-alert{
  display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-radius:12px;
  border:1px solid rgba(255,125,0,.24);background:rgba(255,125,0,.09);color:var(--text-sub);
}
.admin-alert .icon{width:19px;height:19px;color:var(--warning);margin-top:2px;flex:none}
.admin-alert strong{display:block;font-size:13px;color:var(--text);margin-bottom:2px}
.admin-alert p{font-size:12px;line-height:1.65}

.provider-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
.provider-card{padding:22px}
.provider-head{display:flex;align-items:flex-start;gap:12px}
.provider-mark{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;flex:none;background:var(--soft);color:var(--text-sub)}
.provider-mark .icon{width:22px;height:22px}
.provider-mark.is-google{color:#4285F4}
.provider-title{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
.provider-title strong{font-size:15px;font-weight:700}
.provider-title>span{display:flex;flex-wrap:wrap;gap:5px}
.provider-title .badge{font-size:10.5px;padding:2px 7px}
.provider-fields{display:flex;flex-direction:column;gap:13px;margin-top:18px}
.provider-warn{
  margin-top:12px;padding:9px 11px;border-radius:8px;font-size:11.5px;line-height:1.6;
  color:var(--warning);background:rgba(255,125,0,.09);
}
.provider-callback{margin-top:14px}
.provider-label{display:block;font-size:12.5px;font-weight:500;color:var(--text-sub);margin-bottom:7px}
.copy-line{display:flex;align-items:center;gap:6px;min-width:0}
.copy-line code{
  flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;
  padding:8px 10px;border-radius:8px;background:var(--soft);border:1px solid var(--border-soft);color:var(--text-sub);
}
.copy-btn{width:30px;height:30px;flex:none}
.copy-btn .icon{width:15px;height:15px}
.provider-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px;flex-wrap:wrap}
.provider-hint{font-size:11.5px;color:var(--text-mute)}
.provider-note{display:flex;align-items:flex-start;gap:10px;padding:14px 16px}
.provider-note .icon{width:17px;height:17px;color:var(--primary);margin-top:2px;flex:none}
.provider-note p{font-size:12px;line-height:1.7;color:var(--text-sub)}

.settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
.settings-card{padding:20px;display:flex;flex-direction:column;gap:14px}
.settings-card-wide{grid-column:1/-1}
.settings-head{display:flex;align-items:center;gap:11px}
.settings-icon{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;flex:none}
.settings-icon .icon{width:18px;height:18px}
.settings-icon.is-orange{color:var(--warning);background:rgba(255,125,0,.12)}
.settings-icon.is-blue{color:var(--primary);background:var(--primary-light)}
.settings-icon.is-purple{color:var(--accent);background:rgba(139,92,246,.12)}
.settings-head div{display:flex;flex-direction:column;gap:2px;min-width:0}
.settings-head strong{font-size:14px;font-weight:700}
.settings-head span{font-size:11.5px;color:var(--text-mute);word-break:break-all}
.setting-row{
  display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:12px;
  border-radius:10px;background:var(--soft);border:1px solid var(--border-soft);cursor:pointer;
}
.setting-row>span:first-child{display:flex;flex-direction:column;gap:2px;min-width:0}
.setting-row strong{font-size:12.5px;font-weight:600}
.setting-row em{font-style:normal;font-size:11px;color:var(--text-mute);line-height:1.6}
.setting-row .switch{flex:none;margin-top:2px}
.settings-cred{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11px;color:var(--text-mute)}
.settings-cred code{
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--text-sub);
  padding:5px 8px;border-radius:7px;background:var(--soft);border:1px solid var(--border-soft);
}
.settings-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.settings-fields .field{min-width:0}
.settings-foot{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.settings-foot .hint{margin:0;flex:1;min-width:220px}

.doc-card{display:flex;align-items:center;gap:16px;padding:20px;flex-wrap:wrap}
.doc-card-mark{
  width:44px;height:44px;border-radius:12px;display:grid;place-items:center;flex:none;
  color:#fff;background:linear-gradient(135deg,#165DFF,#8B5CF6);box-shadow:0 8px 20px rgba(22,93,255,.24);
}
.doc-card-mark .icon{width:21px;height:21px}
.doc-card-copy{flex:1;min-width:220px;display:flex;flex-direction:column;gap:3px}
.doc-card-copy strong{font-size:14.5px;font-weight:700}
.doc-card-copy p{font-size:12px;line-height:1.65;color:var(--text-mute)}
.doc-card-actions{display:flex;gap:8px;flex-wrap:wrap}

.admin-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
.admin-section-head h2{font-size:17px;font-weight:700}
.admin-section-head p{font-size:12.5px;color:var(--text-mute);margin-top:4px}

.admin-empty{display:flex;flex-direction:column;align-items:center;text-align:center;padding:44px 24px;gap:7px}
.admin-empty.compact{padding:32px 20px}
.admin-empty-icon{width:52px;height:52px;border-radius:15px;display:grid;place-items:center;background:var(--primary-light);color:var(--primary);margin-bottom:4px}
.admin-empty-icon .icon{width:24px;height:24px}
.admin-empty h3{font-size:15px;font-weight:700}
.admin-empty p{font-size:12.5px;color:var(--text-mute);max-width:400px;line-height:1.7}
.admin-empty .btn{margin-top:8px}

.client-list{display:flex;flex-direction:column;gap:14px}
.client-card{padding:20px}
.client-head{display:flex;align-items:flex-start;gap:12px}
.client-mark{
  width:40px;height:40px;border-radius:11px;display:grid;place-items:center;flex:none;
  font-size:16px;font-weight:700;color:#fff;background:linear-gradient(135deg,var(--primary),var(--accent));
  box-shadow:0 5px 14px rgba(22,93,255,.22);
}
.client-title{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.client-title strong{font-size:14.5px;font-weight:700}
.client-title span{font-size:12px;color:var(--text-mute);line-height:1.5}
.client-title .muted{color:var(--text-mute)}
.client-badges{display:flex;gap:5px;flex-wrap:wrap;padding-top:4px}
.client-badges .badge{font-size:10.5px;padding:2px 7px}
.client-grid{
  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 22px;
  margin-top:16px;padding-top:16px;border-top:1px solid var(--border-soft);
}
.client-cell{min-width:0;display:flex;flex-direction:column;gap:4px}
.client-cell>span{font-size:11px;color:var(--text-mute)}
.client-cell p{font-size:12.5px;color:var(--text-sub);line-height:1.5}
.client-cell-wide{grid-column:1/-1}
.client-uri{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:var(--text-sub);line-height:1.65;word-break:break-all}
.client-actions{display:flex;gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid var(--border-soft);flex-wrap:wrap}

.endpoint-list{display:flex;flex-direction:column;gap:10px}
.endpoint-row{
  display:flex;align-items:center;gap:16px;padding:12px 14px;border-radius:11px;
  background:var(--soft);border:1px solid var(--border-soft);
}
.endpoint-copy{width:150px;flex:none;display:flex;flex-direction:column;gap:2px}
.endpoint-copy strong{font-size:12.5px;font-weight:600}
.endpoint-copy span{font-size:10.5px;color:var(--text-mute);line-height:1.45}
.endpoint-value{flex:1;min-width:0}
.endpoint-value code{font-size:11px}

.access-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:18px}
.access-title{font-size:15px;font-weight:700;margin-bottom:14px}
.access-steps{list-style:none;display:flex;flex-direction:column;gap:13px}
.access-steps li{display:flex;gap:12px}
.access-steps li>span{
  width:28px;height:28px;border-radius:8px;flex:none;display:grid;place-items:center;
  font-size:10.5px;font-weight:700;color:var(--primary);background:var(--primary-light);
}
.access-steps strong{display:block;font-size:12.5px;font-weight:600}
.access-steps p{font-size:11.5px;color:var(--text-mute);line-height:1.6;margin-top:2px}
.scope-list{display:flex;flex-direction:column;gap:12px}
.scope-row{display:flex;gap:10px}
.scope-key{
  flex:none;height:24px;padding:0 8px;border-radius:6px;display:inline-flex;align-items:center;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;font-weight:600;
  color:var(--primary);background:var(--primary-light);
}
.scope-row strong{display:block;font-size:12.5px}
.scope-row p{font-size:11.5px;color:var(--text-mute);line-height:1.6;margin-top:2px}
.access-note{display:flex;gap:9px;margin-top:16px;padding:12px;border-radius:10px;background:var(--soft)}
.access-note .icon{width:16px;height:16px;color:var(--primary);margin-top:2px;flex:none}
.access-note p{font-size:11.5px;color:var(--text-sub);line-height:1.65}
.access-code{
  padding:16px;border-radius:12px;background:#0c1425;color:#c9d6ee;overflow-x:auto;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;line-height:1.75;
}
.access-code code{white-space:pre}

.audit-list{display:flex;flex-direction:column}
.audit-row{display:flex;align-items:flex-start;gap:12px;padding:13px 2px;border-bottom:1px solid var(--border-soft)}
.audit-row:last-child{border-bottom:none;padding-bottom:0}
.audit-dot{width:7px;height:7px;border-radius:50%;margin-top:7px;flex:none;background:var(--primary);box-shadow:0 0 0 4px var(--primary-light)}
.audit-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.audit-copy strong{font-size:12.5px;font-weight:600}
.audit-copy span{font-size:11.5px;color:var(--text-mute);line-height:1.55;word-break:break-word}
.audit-meta{display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex:none;font-size:10.5px;color:var(--text-mute)}
.audit-meta em{font-style:normal}

.admin-list{display:flex;flex-direction:column}
.admin-row{display:flex;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid var(--border-soft)}
.admin-row:last-child{border-bottom:none}
.admin-avatar{
  width:38px;height:38px;border-radius:11px;flex:none;display:grid;place-items:center;
  font-size:14px;font-weight:700;color:#fff;background:linear-gradient(135deg,#165DFF,#8B5CF6);
}
.admin-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.admin-copy strong{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600}
.admin-copy span{font-size:11.5px;color:var(--text-mute);word-break:break-all}
.admin-grant{display:flex;align-items:flex-end;gap:12px;margin-top:18px;padding-top:18px;border-top:1px solid var(--border-soft)}
.admin-grant .field{flex:1}

.modal-form{display:flex;flex-direction:column;gap:15px}
.modal-textarea{height:auto;padding:10px 12px;line-height:1.65;resize:vertical}
.scope-picker{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
.scope-option{
  display:flex;align-items:flex-start;gap:9px;padding:11px 12px;border-radius:10px;
  border:1px solid var(--border);background:var(--card);text-align:left;cursor:pointer;
  transition:border-color .18s,background .18s;
}
.scope-option .icon{width:16px;height:16px;color:var(--text-mute);margin-top:2px;flex:none}
.scope-option span{display:flex;flex-direction:column;gap:1px}
.scope-option strong{font-size:12.5px;font-weight:600}
.scope-option em{font-style:normal;font-size:10.5px;color:var(--text-mute);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.scope-option.active{border-color:rgba(22,93,255,.46);background:var(--primary-light)}
.scope-option.active .icon{color:var(--primary)}
.public-toggle{display:flex;align-items:flex-start;gap:11px;padding:12px;border-radius:10px;background:var(--soft);cursor:pointer}
.public-toggle>span:last-child{display:flex;flex-direction:column;gap:2px}
.public-toggle strong{font-size:12.5px;font-weight:600}
.public-toggle em{font-style:normal;font-size:11px;color:var(--text-mute);line-height:1.55}
.modal-error{
  padding:9px 11px;border-radius:8px;font-size:12px;color:var(--danger);background:rgba(245,63,63,.09);
}
.secret-alert{display:flex;gap:10px;padding:12px;border-radius:10px;background:rgba(255,125,0,.09);margin-bottom:14px}
.secret-alert .icon{width:18px;height:18px;color:var(--warning);margin-top:2px;flex:none}
.secret-alert p{font-size:12px;color:var(--text-sub);line-height:1.65}
.secret-box{display:flex;align-items:center;gap:8px;padding:12px;border-radius:10px;background:var(--soft);border:1px solid var(--border)}
.secret-box code{flex:1;min-width:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;word-break:break-all;line-height:1.6}
.confirm-copy{font-size:13px;color:var(--text-sub);line-height:1.75}

.settings-icon.is-green{color:var(--success);background:rgba(0,180,42,.1)}
.settings-icon.is-cyan{color:var(--cyan);background:rgba(6,182,212,.12)}
.feature-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.feature-row{padding:11px 12px}
.feature-row strong{font-size:12.5px}

.head-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.broadcast-card{padding:20px}
.broadcast-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.broadcast-body{grid-column:1/-1}
.broadcast-foot{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:14px;padding-top:14px;border-top:1px solid var(--border-soft)}
.broadcast-foot .hint{margin:0;flex:1;min-width:220px}

.manage-list{display:flex;flex-direction:column}
.manage-row{display:flex;align-items:center;gap:13px;padding:13px 0;border-bottom:1px solid var(--border-soft)}
.manage-row:last-child{border-bottom:none;padding-bottom:0}
.manage-mark{
  width:40px;height:40px;border-radius:11px;flex:none;display:grid;place-items:center;
  font-size:15px;font-weight:700;color:#fff;background:linear-gradient(135deg,var(--primary),var(--accent));
}
.manage-mark .icon{width:19px;height:19px}
.manage-mark.is-blue{background:linear-gradient(135deg,#165DFF,#4D8DFF)}
.manage-mark.is-purple{background:linear-gradient(135deg,#8B5CF6,#C084FC)}
.manage-mark.is-cyan{background:linear-gradient(135deg,#0891B2,#22D3EE)}
.manage-mark.is-green{background:linear-gradient(135deg,#059669,#34D399)}
.manage-mark.is-orange{background:linear-gradient(135deg,#EA580C,#FBBF24)}
.manage-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.manage-copy strong{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:13px;font-weight:600}
.manage-copy strong .badge{font-size:10px;padding:1px 6px}
.manage-copy>span{font-size:11.5px;color:var(--text-mute);line-height:1.5;word-break:break-word}
.manage-copy>em{font-style:normal;font-size:10.5px;color:var(--text-mute);line-height:1.5;word-break:break-all}
.manage-price{flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:1px}
.manage-price strong{font-size:14px;font-weight:700;font-variant-numeric:tabular-nums}
.manage-price span{font-size:10px;color:var(--text-mute)}
.manage-actions{display:flex;gap:6px;flex:none;flex-wrap:wrap;justify-content:flex-end}

.finance-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.finance-grid .admin-stat{background:var(--card);border:1px solid var(--card-border);box-shadow:var(--shadow-card)}
.finance-grid .admin-stat em{margin-left:0}

.user-search{display:flex;gap:10px;padding-bottom:16px;border-bottom:1px solid var(--border-soft);margin-bottom:4px}
.user-search .input{flex:1}

.modal-summary{display:flex;flex-direction:column;gap:3px;padding:12px 14px;border-radius:10px;background:var(--soft);border:1px solid var(--border-soft)}
.modal-summary strong{font-size:14px;font-weight:700}
.modal-summary span{font-size:11.5px;color:var(--text-mute);line-height:1.55;word-break:break-all}
.modal-note{display:flex;gap:9px;padding:11px 12px;border-radius:9px;background:var(--soft)}
.modal-note.warn{background:rgba(255,125,0,.08)}
.modal-note .icon{width:16px;height:16px;color:var(--warning);margin-top:2px;flex:none}
.modal-note p{font-size:11.5px;color:var(--text-sub);line-height:1.65}

@media(max-width:960px){
  .admin-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
  .finance-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .provider-grid{grid-template-columns:1fr}
  .settings-grid{grid-template-columns:1fr}
  .settings-card-wide{grid-column:auto}
  .access-grid{grid-template-columns:1fr}
  .broadcast-grid{grid-template-columns:1fr}
  .admin-orbit{display:none}
}
@media(max-width:640px){
  .admin-banner{padding:22px 20px}
  .admin-banner h2{font-size:19px}
  .admin-stats{grid-template-columns:1fr 1fr;gap:10px}
  .finance-grid{grid-template-columns:1fr}
  .admin-stat{padding:13px;gap:9px;flex-wrap:wrap}
  .admin-stat em{width:100%;margin-left:47px;text-align:left}
  .admin-tabs{flex-wrap:wrap;overflow:visible}
  .admin-tab{flex:1 0 auto;justify-content:center;padding:0 10px;font-size:12.5px}
  .client-head{flex-wrap:wrap}
  .client-badges{order:3;width:100%;padding-left:52px}
  .client-head>.switch{margin-left:auto}
  .client-grid{grid-template-columns:1fr}
  .client-cell-wide{grid-column:auto}
  .endpoint-row{flex-direction:column;align-items:stretch;gap:7px}
  .endpoint-copy{width:auto}
  .admin-grant{flex-direction:column;align-items:stretch}
  .scope-picker{grid-template-columns:1fr}
  .audit-meta{display:none}
  .settings-fields{grid-template-columns:1fr}
  .feature-grid{grid-template-columns:1fr}
  .broadcast-grid{grid-template-columns:1fr}
  .manage-row{flex-wrap:wrap}
  .manage-price{align-items:flex-start;flex-direction:row;gap:4px}
  .manage-actions{margin-left:53px;width:100%;justify-content:flex-start}
  .user-search{flex-direction:column}
  .doc-card{align-items:flex-start}
  .doc-card-actions{width:100%}
  .doc-card-actions .btn{flex:1}
}
</style>
