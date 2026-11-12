<script setup>
import { computed, reactive, ref } from 'vue';
import { Button, FxField, Input, Select, Switch, Textarea } from 'fuxsto-design-pro';
import AppIcon from '../../components/AppIcon.vue';
import BaseModal from '../../components/BaseModal.vue';
import { api } from '../../lib/api';
import {
  NOTIFICATION_CATEGORIES,
  PRODUCT_ICONS,
  TONES,
  bareIcon,
  stockLabel,
} from '../../lib/adminHelpers';
import { money } from '../../lib/format';
import { toast } from '../../lib/toast';

const props = defineProps({
  data: { type: Object, default: null },
  reload: { type: Function, required: true },
  askConfirm: { type: Function, required: true },
});

const productList = computed(() => props.data?.products || []);
const templateList = computed(() => props.data?.agreementTemplates || []);
const categoryOptions = NOTIFICATION_CATEGORIES.map((item) => ({ label: item.label, value: item.key }));
const productIconOptions = PRODUCT_ICONS.map((icon) => ({ label: icon, value: icon }));
const toneOptions = TONES.map((tone) => ({ label: tone, value: tone }));

/* ---------- 站内信广播 ---------- */

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

/* ---------- 商品管理 ---------- */

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
    productError.value = '商品价格需在 1–100000 余额之间';
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
    await props.reload({ silent: true });
  } catch (error) {
    productError.value = error.message;
  } finally {
    savingProduct.value = false;
  }
}

function deleteProduct(product) {
  props.askConfirm({
    title: '删除商品',
    message: `删除「${product.name}」后，积分商城将不再展示该商品，历史订单不受影响。`,
    confirmText: '删除商品',
    danger: true,
    action: async () => {
      await api.del(`/admin/products/${product.id}`);
      toast('商品已删除');
      await props.reload({ silent: true });
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
    await props.reload({ silent: true });
  } catch (error) {
    templateError.value = error.message;
  } finally {
    savingTemplate.value = false;
  }
}

function deleteTemplate(template) {
  props.askConfirm({
    title: '删除协议模板',
    message: `删除「${template.title}」后，新用户将不再收到该协议；已签署记录仍会保留。`,
    confirmText: '删除模板',
    danger: true,
    action: async () => {
      await api.del(`/admin/agreement-templates/${template.id}`);
      toast('协议模板已删除');
      await props.reload({ silent: true });
    },
  });
}
</script>

<template>
  <section class="admin-section">
    <div class="admin-section-head">
      <div>
        <h2>内容与商品</h2>
        <p>商品、协议模板与站内信广播，全部写入 D1 并立即生效。</p>
      </div>
    </div>

    <div class="card broadcast-card">
      <div class="card-head">
        <h2>发送站内信</h2>
        <span class="badge badge-blue">全员 / 指定用户</span>
      </div>
      <div class="broadcast-grid">
        <div class="field">
          <span class="field-label">消息标题</span>
          <Input aria-label="消息标题" v-model="broadcastForm.title" maxlength="40" placeholder="例如：积分商城上新" />
        </div>
        <FxField v-select-label="'消息分类'" label="消息分类">
          <Select v-model="broadcastForm.category" :options="categoryOptions" />
        </FxField>
        <div class="field">
          <span class="field-label">指定用户邮箱（可选）</span>
          <Input aria-label="指定用户邮箱（可选）" v-model="broadcastForm.email" placeholder="留空表示发送给全部用户" />
        </div>
        <div class="field">
          <span class="field-label">跳转路径（可选）</span>
          <Input aria-label="跳转路径（可选）" v-model="broadcastForm.link" maxlength="200" placeholder="/wallet" />
        </div>
        <div class="field broadcast-body">
          <span class="field-label">正文</span>
          <Textarea aria-label="正文" v-model="broadcastForm.body" :rows="3" :maxlength="300" placeholder="最多 300 个字符" />
        </div>
      </div>
      <div class="broadcast-foot">
        <p class="hint">发送后用户可在「站内信」与通知中心查看，并受分类偏好开关影响。</p>
        <Button variant="primary" type="button" :disabled="broadcastForm.sending" @click="sendBroadcast">
          <span v-if="broadcastForm.sending" class="spinner" />
          <span>{{ broadcastForm.sending ? '发送中…' : '发送站内信' }}</span>
        </Button>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <h2>商品</h2>
        <div class="head-actions">
          <span class="head-note">{{ productList.length }} 件</span>
          <Button variant="primary" size="sm" type="button" @click="openCreateProduct">
            <AppIcon name="plus" />
            <span>新增商品</span>
          </Button>
        </div>
      </div>

      <div v-if="!productList.length" class="admin-empty compact">
        <span class="admin-empty-icon"><AppIcon name="box" /></span>
        <h3>还没有商品</h3>
        <p>新增商品后，已认证的实名用户即可在积分商城兑换。</p>
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
            <span>余额</span>
          </div>
          <div class="manage-actions">
            <Button variant="secondary" size="sm" type="button" @click="openEditProduct(product)">编辑</Button>
            <Button variant="destructive" size="sm" type="button" @click="deleteProduct(product)">删除</Button>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <h2>协议模板</h2>
        <div class="head-actions">
          <span class="head-note">{{ templateList.length }} 份</span>
          <Button variant="primary" size="sm" type="button" @click="openCreateTemplate">
            <AppIcon name="plus" />
            <span>新增协议</span>
          </Button>
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
            <span>{{ template.version }} · 签署奖励 {{ template.reward }} 积分 · 排序 {{ template.sort }}</span>
            <em>{{ (template.content || '').slice(0, 48) }}{{ (template.content || '').length > 48 ? '…' : '' }}</em>
          </div>
          <div class="manage-actions">
            <Button variant="secondary" size="sm" type="button" @click="openEditTemplate(template)">编辑</Button>
            <Button variant="destructive" size="sm" type="button" @click="deleteTemplate(template)">删除</Button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- 商品编辑 -->
  <BaseModal v-model="productModal" :title="editingProduct ? '编辑商品' : '新增商品'" width="560px">
    <div class="modal-form">
      <div class="settings-fields">
        <div class="field">
          <span class="field-label">商品名称</span>
          <Input aria-label="商品名称" v-model="productForm.name" maxlength="40" placeholder="例如：INU 帆布袋" />
        </div>
        <div class="field">
          <span class="field-label">价格（余额）</span>
          <Input aria-label="价格（余额）" :model-value="productForm.priceYuan" type="number" min="1" step="0.01" @update:model-value="productForm.priceYuan = Number($event)" />
        </div>
      </div>
      <div class="field">
        <span class="field-label">商品描述</span>
        <Input aria-label="商品描述" v-model="productForm.desc" maxlength="160" placeholder="一句话介绍这件商品" />
      </div>
      <div class="settings-fields">
        <FxField v-select-label="'图标'" label="图标">
          <Select v-model="productForm.icon" :options="productIconOptions" />
        </FxField>
        <FxField v-select-label="'配色'" label="配色">
          <Select v-model="productForm.tone" :options="toneOptions" />
        </FxField>
      </div>
      <div class="settings-fields">
        <div class="field">
          <span class="field-label">标签</span>
          <Input aria-label="标签" v-model="productForm.tag" maxlength="12" placeholder="例如：限定" />
        </div>
        <div class="field">
          <span class="field-label">商品 ID</span>
          <Input aria-label="商品 ID" v-model="productForm.id" :disabled="Boolean(editingProduct)" maxlength="40" placeholder="留空自动生成" />
        </div>
      </div>
      <div class="settings-fields">
        <div class="field">
          <span class="field-label">库存（-1 表示不限）</span>
          <Input aria-label="库存（-1 表示不限）" :model-value="productForm.stock" type="number" min="-1" max="99999" @update:model-value="productForm.stock = Number($event)" />
        </div>
        <div class="field">
          <span class="field-label">排序值</span>
          <Input aria-label="排序值" :model-value="productForm.sort" type="number" min="0" max="9999" @update:model-value="productForm.sort = Number($event)" />
        </div>
      </div>
      <div class="public-toggle">
        <Switch v-model="productForm.active" aria-label="立即上架" />
        <span><strong>立即上架</strong><em>关闭后商品保留在后台，但积分商城不再展示</em></span>
      </div>
      <p v-if="productError" class="modal-error">{{ productError }}</p>
    </div>
    <template #footer>
      <Button variant="secondary" type="button" @click="productModal = false">取消</Button>
      <Button variant="primary" type="button" :disabled="savingProduct" @click="submitProduct">
        <span v-if="savingProduct" class="spinner" />
        <span>{{ savingProduct ? '保存中…' : editingProduct ? '保存修改' : '创建商品' }}</span>
      </Button>
    </template>
  </BaseModal>

  <!-- 协议模板编辑 -->
  <BaseModal v-model="templateModal" :title="editingTemplate ? '编辑协议模板' : '新增协议模板'" width="640px">
    <div class="modal-form">
      <div class="settings-fields">
        <div class="field">
          <span class="field-label">协议名称</span>
          <Input aria-label="协议名称" v-model="templateForm.title" maxlength="40" placeholder="例如：服务协议" />
        </div>
        <div class="field">
          <span class="field-label">版本号</span>
          <Input aria-label="版本号" v-model="templateForm.version" maxlength="20" placeholder="v1.0" />
        </div>
      </div>
      <div class="settings-fields">
        <div class="field">
          <span class="field-label">签署奖励（积分）</span>
          <Input aria-label="签署奖励（积分）" :model-value="templateForm.reward" type="number" min="0" max="10000" @update:model-value="templateForm.reward = Number($event)" />
        </div>
        <div class="field">
          <span class="field-label">排序值</span>
          <Input aria-label="排序值" :model-value="templateForm.sort" type="number" min="0" max="9999" @update:model-value="templateForm.sort = Number($event)" />
        </div>
      </div>
      <div class="field">
        <span class="field-label">协议正文（Markdown / 纯文本）</span>
        <Textarea aria-label="协议正文（Markdown / 纯文本）" v-model="templateForm.content" :rows="10" :maxlength="20000" placeholder="填写协议条款，支持换行与 Markdown。" />
        <p class="hint">保存后会同步更新所有待签署记录；重新启用时会为全部用户补齐待签。</p>
      </div>
      <div class="public-toggle">
        <Switch v-model="templateForm.active" aria-label="生效中" />
        <span><strong>生效中</strong><em>下架后用户仍可查看已签署版本，但不再收到新的待签提醒</em></span>
      </div>
      <p v-if="templateError" class="modal-error">{{ templateError }}</p>
    </div>
    <template #footer>
      <Button variant="secondary" type="button" @click="templateModal = false">取消</Button>
      <Button variant="primary" type="button" :disabled="savingTemplate" @click="submitTemplate">
        <span v-if="savingTemplate" class="spinner" />
        <span>{{ savingTemplate ? '保存中…' : editingTemplate ? '保存修改' : '创建模板' }}</span>
      </Button>
    </template>
  </BaseModal>
</template>
