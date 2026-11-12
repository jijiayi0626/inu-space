<script setup>
import { computed, reactive, ref } from 'vue';
import { Button, Input } from 'fuxsto-design-pro';
import AppIcon from '../components/AppIcon.vue';
import BaseModal from '../components/BaseModal.vue';
import PageHeader from '../components/PageHeader.vue';
import SkeletonBlock from '../components/SkeletonBlock.vue';
import { api } from '../lib/api';
import { maskPhone, money, moneyParts, timeLabel } from '../lib/format';
import { session, setUser } from '../lib/session';
import { toast } from '../lib/toast';
import { useAsyncData } from '../lib/useAsyncData';

const { data, reload } = useAsyncData(({ force }) => api.get('/supply', { force }));

const wallet = computed(() => data.value?.wallet || { balanceCents: 0, cardLast4: '0721' });
const balanceParts = computed(() => moneyParts(wallet.value.balanceCents));
const address = computed(() => data.value?.address || null);
const verified = computed(() => data.value?.verified ?? session.user?.verified ?? false);

const statusMap = {
  transit: { label: '配送中', tone: 'orange' },
  delivered: { label: '已送达', tone: 'green' },
  pending_payment: { label: '待支付', tone: 'orange' },
  paid: { label: '已支付', tone: 'blue' },
  cancelled: { label: '已取消', tone: 'gray' },
};

const featureEnabled = computed(() => data.value?.featureEnabled !== false);

const selectedProduct = ref(null);
const orderOpen = ref(false);
const ordering = ref(false);

function openOrder(product) {
  selectedProduct.value = product;
  orderOpen.value = true;
}

async function confirmOrder() {
  if (!selectedProduct.value) return;
  ordering.value = true;
  try {
    const result = await api.post('/supply/orders', { productId: selectedProduct.value.id });
    orderOpen.value = false;
    if (session.user) {
      setUser({
        ...session.user,
        starEnergyCents: result.balanceCents,
        particles: result.particles,
      });
    }
    toast(`兑换成功，+${result.reward} 积分`);
    await reload({ silent: true });
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    ordering.value = false;
  }
}

const addressOpen = ref(false);
const addressSaving = ref(false);
const addressError = ref('');
const addressForm = reactive({ receiver: '', phone: '', region: '', detail: '' });

function openAddress() {
  addressError.value = '';
  addressForm.receiver = address.value?.receiver || '';
  addressForm.phone = address.value?.phone || '';
  addressForm.region = address.value?.region || '上海 · 中国';
  addressForm.detail = address.value?.detail || '';
  addressOpen.value = true;
}

async function saveAddress() {
  addressError.value = '';
  if (!addressForm.receiver.trim()) {
    addressError.value = '请填写收货人';
    return;
  }
  if (!/^1[3-9]\d{9}$/.test(addressForm.phone)) {
    addressError.value = '请输入有效的 11 位手机号';
    return;
  }
  if (!addressForm.region.trim() || addressForm.detail.trim().length < 5) {
    addressError.value = '请填写地区与完整的收货地址';
    return;
  }

  addressSaving.value = true;
  try {
    const result = await api.patch('/supply/address', { ...addressForm });
    if (data.value) data.value = { ...data.value, address: result.address };
    addressOpen.value = false;
    toast('收货地址已保存');
  } catch (error) {
    addressError.value = error.message;
  } finally {
    addressSaving.value = false;
  }
}

function orderAction(order) {
  if (order.status === 'transit') openOrderDetail(order);
  else if (order.status === 'delivered' || order.status === 'cancelled') rebuy(order);
  else if (order.status === 'pending_payment') payOrder(order);
  else openOrderDetail(order);
}

function actionLabel(order) {
  if (order.status === 'transit') return '查看物流';
  if (order.status === 'delivered') return '再次购买';
  if (order.status === 'cancelled') return '重新下单';
  if (order.status === 'pending_payment') return '去支付';
  return '查看详情';
}

const detailOpen = ref(false);
const detailOrder = ref(null);
const detailLoading = ref(false);
const detailActionLoading = ref(false);

async function openOrderDetail(order) {
  detailOpen.value = true;
  detailOrder.value = { ...order, timeline: [] };
  detailLoading.value = true;
  try {
    const result = await api.get(`/supply/orders/${order.id}`, { force: true, ttl: 0 });
    detailOrder.value = result.order;
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    detailLoading.value = false;
  }
}

function syncWallet(result) {
  if (!session.user) return;
  const patch = {};
  if (result.balanceCents !== undefined) patch.starEnergyCents = result.balanceCents;
  if (result.particles !== undefined) patch.particles = result.particles;
  if (Object.keys(patch).length) setUser({ ...session.user, ...patch });
}

async function rebuy(order) {
  try {
    const result = await api.post(`/supply/orders/${order.id}/rebuy`);
    syncWallet(result);
    toast(result.message || '已按原订单重新下单');
    await reload({ silent: true });
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function payOrder(order) {
  detailActionLoading.value = true;
  try {
    const result = await api.post(`/supply/orders/${order.id}/pay`);
    syncWallet(result);
    if (detailOrder.value?.id === order.id) detailOrder.value = { ...result.order, timeline: detailOrder.value.timeline };
    toast('支付成功，商品已进入配送流程');
    await reload({ silent: true });
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    detailActionLoading.value = false;
  }
}

async function cancelOrder(order) {
  detailActionLoading.value = true;
  try {
    const result = await api.post(`/supply/orders/${order.id}/cancel`);
    detailOrder.value = { ...result.order, timeline: detailOrder.value?.timeline || [] };
    toast('订单已取消');
    await reload({ silent: true });
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    detailActionLoading.value = false;
  }
}

async function confirmDelivery(order) {
  detailActionLoading.value = true;
  try {
    const result = await api.post(`/supply/orders/${order.id}/confirm`);
    detailOrder.value = { ...result.order, timeline: detailOrder.value?.timeline || [] };
    toast('已确认收货，商品已归档');
    await reload({ silent: true });
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    detailActionLoading.value = false;
  }
}

const allOrdersOpen = ref(false);
const allOrders = ref([]);
const allOrdersLoading = ref(false);

async function loadAllOrders() {
  allOrdersOpen.value = true;
  allOrdersLoading.value = true;
  try {
    const result = await api.get('/supply/orders?limit=100', { force: true, ttl: 0 });
    allOrders.value = result.orders || [];
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    allOrdersLoading.value = false;
  }
}
</script>

<template>
  <PageHeader title="积分商城" sub="用账户余额兑换商品，会员折扣自动生效。">
    <template #meta>
      <span class="badge badge-blue">{{ data?.user?.tierLabel || '普通' }}会员 · {{ data?.discountLabel || '95 折' }}</span>
      <span class="head-date">商品每日更新</span>
    </template>
  </PageHeader>

  <section v-if="!data" class="card">
    <SkeletonBlock :rows="8" row-height="18px" />
  </section>

  <template v-else>
    <div class="overview-grid">
      <article class="stat-card">
        <div class="stat-top">
          <span class="stat-icon"><AppIcon name="wallet" /></span>
          <span class="badge badge-blue">INU 支付</span>
        </div>
        <div>
          <p class="stat-name">可用余额</p>
          <p class="stat-value">{{ balanceParts.integer }}<small>.{{ balanceParts.decimal }}</small></p>
        </div>
        <p class="stat-foot">账户余额 · INU ···· {{ wallet.cardLast4 }}</p>
      </article>
      <article class="stat-card">
        <div class="stat-top">
          <span class="stat-icon"><AppIcon name="box" /></span>
          <span class="badge badge-orange">{{ data.counts.transit }} 单</span>
        </div>
        <div>
          <p class="stat-name">运输中订单</p>
          <p class="stat-value">{{ data.counts.transit }}</p>
        </div>
        <p class="stat-foot">配送进度可在订单详情查看</p>
      </article>
      <article class="stat-card">
        <div class="stat-top">
          <span class="stat-icon"><AppIcon name="chart" /></span>
        </div>
        <div>
          <p class="stat-name">本月商品</p>
          <p class="stat-value">{{ data.counts.monthOrders }}<small>单</small></p>
        </div>
        <p class="stat-foot">累计消耗 {{ money(data.counts.monthSpendCents) }} 余额</p>
      </article>
    </div>

    <section class="card supply-shelf">
      <div class="card-head">
        <h2>在售商品</h2>
        <span class="head-note">会员价已生效</span>
      </div>
      <div class="product-grid">
        <article v-for="product in data.products" :key="product.id" class="product-card">
          <div class="product-top">
            <span class="product-icon" :class="`product-${product.tone}`"><AppIcon :name="product.icon" /></span>
            <span class="badge" :class="product.tone === 'blue' ? 'badge-blue' : product.tone === 'orange' ? 'badge-orange' : 'badge-gray'">
              {{ product.tag }}
            </span>
          </div>
          <div class="product-copy">
            <p class="product-name">{{ product.name }}</p>
            <p class="product-desc">{{ product.desc }}</p>
          </div>
          <div class="product-foot">
            <div class="product-price">
              <strong>{{ money(product.memberPriceCents) }}</strong><span>余额</span>
              <em v-if="product.memberPriceCents < product.priceCents">{{ money(product.priceCents) }}</em>
            </div>
            <RouterLink v-if="!verified" class="btn btn-ghost btn-sm" to="/profile#verify">需认证</RouterLink>
            <Button variant="primary" size="sm" v-else type="button" :disabled="!featureEnabled" @click="openOrder(product)">
              {{ featureEnabled ? '兑换' : '暂停开放' }}
            </Button>
          </div>
        </article>
      </div>
      <p class="card-note">
        <AppIcon name="idcard" />
        <span v-if="verified">实名认证已完成，商品兑换与余额提现能力均已解锁。</span>
        <span v-else>完成实名认证后，积分商城下单与余额提现能力将一并解锁。</span>
      </p>
    </section>

    <section id="orders" class="card">
      <div class="card-head">
        <h2>订单</h2>
        <button class="btn btn-text" @click="loadAllOrders">查看全部</button>
      </div>
      <div class="table-wrap">
        <table class="data-table responsive orders">
          <thead>
            <tr><th>订单</th><th>商品</th><th>消耗</th><th>状态</th><th class="actions">操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="order in data.orders" :key="order.id">
              <td class="num">{{ order.code }}</td>
              <td>{{ order.item }}</td>
              <td class="num">{{ money(order.energyCents) }}</td>
              <td>
                <span class="badge" :class="`badge-${statusMap[order.status]?.tone || 'gray'}`">
                  {{ statusMap[order.status]?.label || order.status }}
                </span>
              </td>
              <td class="actions">
                <button class="btn btn-text" type="button" @click="orderAction(order)">
                  {{ actionLabel(order) }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="card-note">
        <AppIcon name="clock" />
        <span>订单状态会通过站内信与安全邮箱通知，配送中的商品预计 1–3 个工作日送达。</span>
      </p>
    </section>

    <div class="overview-row">
      <section id="address" class="card">
        <div class="card-head">
          <h2>收货地址</h2>
          <span class="badge" :class="address ? 'badge-green' : 'badge-gray'">
            {{ address ? '已设置' : '未设置' }}
          </span>
        </div>

        <template v-if="address">
          <div class="address-card">
            <span class="address-icon"><AppIcon name="map" /></span>
            <div class="address-copy">
              <p class="address-name">{{ address.receiver }} <span>{{ maskPhone(address.phone) }}</span></p>
              <p class="address-detail">{{ address.region }} · {{ address.detail }}</p>
              <p class="address-meta">最近更新 {{ timeLabel(address.updatedAt) }}</p>
            </div>
            <Button variant="secondary" size="sm" type="button" @click="openAddress">编辑</Button>
          </div>
        </template>
        <div v-else class="inline-empty">
          <span class="inline-empty-icon"><AppIcon name="map" /></span>
          <h3>还没有默认地址</h3>
          <p>添加收货地址后，商品会通过快递寄送。</p>
          <Button variant="primary" size="sm" type="button" @click="openAddress">添加地址</Button>
        </div>
      </section>

      <section id="supply-tips" class="card">
        <div class="card-head">
          <h2>商城说明</h2>
        </div>
        <div v-for="tip in data.tips" :key="tip.text" class="tip-item">
          <AppIcon :name="tip.icon" /><span>{{ tip.text }}</span>
        </div>
      </section>
    </div>
  </template>

  <BaseModal v-model="orderOpen" title="兑换商品" width="460px">
    <template v-if="selectedProduct">
      <div class="modal-device">
        <span class="product-icon" :class="`product-${selectedProduct.tone}`"><AppIcon :name="selectedProduct.icon" /></span>
        <div>
          <p class="modal-device-name">{{ selectedProduct.name }}</p>
          <p class="modal-device-sub">{{ selectedProduct.tag }} · 会员折扣 {{ data?.discountLabel }}</p>
        </div>
      </div>
      <dl class="detail-list">
        <div class="detail-row"><dt>商品</dt><dd>{{ selectedProduct.desc }}</dd></div>
        <div class="detail-row"><dt>会员价</dt><dd>{{ money(selectedProduct.memberPriceCents) }} 余额</dd></div>
        <div class="detail-row"><dt>可用余额</dt><dd>{{ money(wallet.balanceCents) }} 余额</dd></div>
        <div class="detail-row"><dt>预计送达</dt><dd>1–3 个工作日</dd></div>
      </dl>
      <p class="card-note">
        <AppIcon name="info" />
        <span>兑换后余额将立即扣除，商品进入配送流程，消费可累计积分。</span>
      </p>
    </template>
    <template #footer>
      <Button variant="secondary" size="sm" type="button" @click="orderOpen = false">取消</Button>
      <Button variant="primary" size="sm" type="button" :disabled="ordering" @click="confirmOrder">
        <span v-if="ordering" class="spinner" />
        {{ ordering ? '正在兑换…' : '确认兑换' }}
      </Button>
    </template>
  </BaseModal>

  <BaseModal v-model="addressOpen" :title="address ? '编辑收货地址' : '添加收货地址'" width="480px">
    <form id="addressForm" @submit.prevent="saveAddress">
      <div class="form-grid">
        <div class="field">
          <span class="field-label">收货人</span>
          <Input aria-label="收货人" v-model="addressForm.receiver" type="text" maxlength="20" placeholder="收货人姓名" />
        </div>
        <div class="field">
          <span class="field-label">手机号</span>
          <Input aria-label="手机号" v-model="addressForm.phone" type="tel" maxlength="11" placeholder="11 位手机号" />
        </div>
        <div class="field span-2">
          <span class="field-label">所在地区</span>
          <Input aria-label="所在地区" v-model="addressForm.region" type="text" maxlength="30" placeholder="上海 · 中国" />
        </div>
        <div class="field span-2">
          <span class="field-label">详细地址</span>
          <Input aria-label="详细地址" v-model="addressForm.detail" type="text" maxlength="80" placeholder="街道、门牌号与房间号" />
        </div>
      </div>
      <p v-if="addressError" class="form-error"><AppIcon name="shield" /><span>{{ addressError }}</span></p>
    </form>
    <template #footer>
      <Button variant="secondary" size="sm" type="button" @click="addressOpen = false">取消</Button>
      <Button variant="primary" size="sm" type="submit" form="addressForm" :disabled="addressSaving">
        <span v-if="addressSaving" class="spinner" />
        {{ addressSaving ? '保存中…' : '保存地址' }}
      </Button>
    </template>
  </BaseModal>

  <BaseModal v-model="detailOpen" title="订单详情" width="540px">
    <div v-if="detailLoading" class="feed">
      <SkeletonBlock :rows="6" />
    </div>
    <template v-else-if="detailOrder">
      <div class="modal-device">
        <span class="device-icon lg"><AppIcon name="box" /></span>
        <div>
          <p class="modal-device-name">{{ detailOrder.item }}</p>
          <p class="modal-device-sub">{{ detailOrder.code }} · {{ timeLabel(detailOrder.createdAt) }}</p>
        </div>
        <span class="badge" :class="`badge-${statusMap[detailOrder.status]?.tone || 'gray'}`">
          {{ statusMap[detailOrder.status]?.label || detailOrder.status }}
        </span>
      </div>

      <div class="timeline">
        <div v-for="(step, index) in detailOrder.timeline || []" :key="index" class="timeline-row">
          <span class="timeline-dot" />
          <div>
            <p class="timeline-title">{{ step.title }}</p>
            <p class="timeline-sub">{{ step.detail }} · {{ timeLabel(step.at) }}</p>
          </div>
        </div>
        <div v-if="!(detailOrder.timeline || []).length" class="quiet-text">物流信息更新中。</div>
      </div>

      <dl class="detail-list">
        <div class="detail-row"><dt>余额消耗</dt><dd>{{ money(detailOrder.energyCents) }} 余额</dd></div>
        <div class="detail-row"><dt>运单号</dt><dd>{{ detailOrder.trackingNo || '待分配' }}</dd></div>
        <div class="detail-row"><dt>承运方</dt><dd>{{ detailOrder.carrier || '快递' }}</dd></div>
        <div v-if="detailOrder.address" class="detail-row">
          <dt>收货地址</dt>
          <dd>{{ detailOrder.address.receiver }} · {{ maskPhone(detailOrder.address.phone) }} · {{ detailOrder.address.region }} {{ detailOrder.address.detail }}</dd>
        </div>
      </dl>
    </template>
    <template #footer>
      <Button variant="secondary" size="sm" type="button" @click="detailOpen = false">关闭</Button>
      <Button variant="secondary" size="sm" v-if="detailOrder?.canCancel" type="button" :disabled="detailActionLoading" @click="cancelOrder(detailOrder)">
        取消订单
      </Button>
      <Button variant="primary" size="sm" v-if="detailOrder?.canPay" type="button" :disabled="detailActionLoading" @click="payOrder(detailOrder)">
        <span v-if="detailActionLoading" class="spinner" />
        去支付
      </Button>
      <Button variant="primary" size="sm" v-if="detailOrder?.canConfirm" type="button" :disabled="detailActionLoading" @click="confirmDelivery(detailOrder)">
        <span v-if="detailActionLoading" class="spinner" />
        确认收货
      </Button>
      <Button variant="primary" size="sm" v-if="detailOrder?.status === 'delivered' || detailOrder?.status === 'cancelled'" type="button" @click="detailOpen = false; rebuy(detailOrder)">
        再次购买
      </Button>
    </template>
  </BaseModal>

  <BaseModal v-model="allOrdersOpen" title="全部订单" width="720px">
    <div v-if="allOrdersLoading" class="feed">
      <SkeletonBlock :rows="6" />
    </div>
    <div v-else class="table-wrap modal-orders">
      <table class="data-table responsive orders">
        <thead>
          <tr><th>订单</th><th>商品</th><th>消耗</th><th>状态</th><th class="actions">操作</th></tr>
        </thead>
        <tbody>
          <tr v-for="order in allOrders" :key="order.id">
            <td class="num">{{ order.code }}</td>
            <td>{{ order.item }}</td>
            <td class="num">{{ money(order.energyCents) }}</td>
            <td>
              <span class="badge" :class="`badge-${statusMap[order.status]?.tone || 'gray'}`">
                {{ statusMap[order.status]?.label || order.status }}
              </span>
            </td>
            <td class="actions">
              <button class="btn btn-text" type="button" @click="allOrdersOpen = false; orderAction(order)">
                {{ actionLabel(order) }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!allOrders.length" class="inline-empty">
        <span class="inline-empty-icon"><AppIcon name="box" /></span>
        <h3>还没有订单</h3>
        <p>兑换物资后，订单会出现在这里。</p>
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.timeline{display:flex;flex-direction:column;gap:12px;margin:14px 0}
.timeline-row{display:flex;gap:11px;align-items:flex-start}
.timeline-dot{width:9px;height:9px;border-radius:50%;background:var(--primary);margin-top:6px;flex:none;box-shadow:0 0 0 4px var(--primary-light)}
.timeline-title{font-size:12.5px;font-weight:600}
.timeline-sub{font-size:11.5px;color:var(--text-mute);line-height:1.6}
.modal-orders{max-height:58vh;overflow:auto}
</style>
