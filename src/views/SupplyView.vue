<script setup>
import { computed, reactive, ref } from 'vue';
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
  transit: { label: '跃迁中', tone: 'orange' },
  delivered: { label: '已送达', tone: 'green' },
  pending_payment: { label: '待支付', tone: 'red' },
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
    toast(`兑换成功，+${result.reward} INU 粒子`);
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
    addressError.value = '请填写星域与完整的收货坐标';
    return;
  }

  addressSaving.value = true;
  try {
    const result = await api.patch('/supply/address', { ...addressForm });
    if (data.value) data.value = { ...data.value, address: result.address };
    addressOpen.value = false;
    toast('收货坐标已同步至星际快递');
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
    toast('支付成功，补给已进入跃迁队列');
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
    toast('已确认收货，补给已归档');
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
  <PageHeader title="星际补给站" sub="用星能兑换星际物资，让每一次跃迁都有充足补给。">
    <template #meta>
      <span class="badge badge-blue">{{ data?.discountLabel || '95 折' }} → {{ data?.user?.tierLabel || '星尘' }}会员</span>
      <span class="head-date">补给网络 · 在线</span>
    </template>
  </PageHeader>

  <section v-if="!data" class="card">
    <SkeletonBlock :rows="8" row-height="18px" />
  </section>

  <template v-else>
    <div class="overview-grid">
      <article class="stat-card">
        <div class="stat-top">
          <span class="stat-icon"><AppIcon name="orbit" /></span>
          <span class="badge badge-blue">INU PAY</span>
        </div>
        <div>
          <p class="stat-name">可用星能</p>
          <p class="stat-value">{{ balanceParts.integer }}<small>.{{ balanceParts.decimal }}</small></p>
        </div>
        <p class="stat-foot">星际钱包 · INU ···· {{ wallet.cardLast4 }}</p>
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
        <p class="stat-foot">最近一单预计明天送达</p>
      </article>
      <article class="stat-card">
        <div class="stat-top">
          <span class="stat-icon"><AppIcon name="spark" /></span>
          <span class="badge badge-green">+18%</span>
        </div>
        <div>
          <p class="stat-name">本月补给</p>
          <p class="stat-value">{{ data.counts.monthOrders }}<small>单</small></p>
        </div>
        <p class="stat-foot">累计消耗 {{ money(data.counts.monthSpendCents) }} 星能</p>
      </article>
    </div>

    <section class="card supply-shelf">
      <div class="card-head">
        <h2>今日补给</h2>
        <span class="head-note">MEMBER PRICE · 会员价已生效</span>
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
              <strong>{{ money(product.memberPriceCents) }}</strong><span>星能</span>
              <em v-if="product.memberPriceCents < product.priceCents">{{ money(product.priceCents) }}</em>
            </div>
            <RouterLink v-if="!verified" class="btn btn-ghost btn-sm" to="/profile#verify">需认证</RouterLink>
            <button
              v-else
              class="btn btn-primary btn-sm"
              type="button"
              :disabled="!featureEnabled"
              @click="openOrder(product)"
            >
              {{ featureEnabled ? '兑换' : '暂停开放' }}
            </button>
          </div>
        </article>
      </div>
      <p class="card-note">
        <AppIcon name="idcard" />
        <span v-if="verified">星际公民认证已完成，补给兑换与星能提现能力均已解锁。</span>
        <span v-else>完成星际公民认证后，补给站下单与星能提现能力将同步解锁。</span>
      </p>
    </section>

    <section id="orders" class="card">
      <div class="card-head">
        <h2>补给订单</h2>
        <button class="btn btn-text" @click="loadAllOrders">查看全部</button>
      </div>
      <div class="table-wrap">
        <table class="data-table responsive orders">
          <thead>
            <tr><th>订单</th><th>补给内容</th><th>星能</th><th>状态</th><th class="actions">操作</th></tr>
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
        <span>订单状态会通过站内信与安全邮箱同步，跃迁中的补给预计 1–3 个星际日送达。</span>
      </p>
    </section>

    <div class="overview-row">
      <section id="address" class="card">
        <div class="card-head">
          <h2>收货坐标</h2>
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
            <button class="btn btn-ghost btn-sm" type="button" @click="openAddress">编辑</button>
          </div>
        </template>
        <div v-else class="inline-empty">
          <span class="inline-empty-icon"><AppIcon name="map" /></span>
          <h3>还没有默认坐标</h3>
          <p>添加收货坐标后，补给物资会通过星际快递精准投递。</p>
          <button class="btn btn-primary btn-sm" type="button" @click="openAddress">添加坐标</button>
        </div>
      </section>

      <section id="supply-tips" class="card">
        <div class="card-head">
          <h2>补给说明</h2>
        </div>
        <div v-for="tip in data.tips" :key="tip.text" class="tip-item">
          <AppIcon :name="tip.icon" /><span>{{ tip.text }}</span>
        </div>
      </section>
    </div>
  </template>

  <BaseModal v-model="orderOpen" title="兑换星际补给" width="460px">
    <template v-if="selectedProduct">
      <div class="modal-device">
        <span class="product-icon" :class="`product-${selectedProduct.tone}`"><AppIcon :name="selectedProduct.icon" /></span>
        <div>
          <p class="modal-device-name">{{ selectedProduct.name }}</p>
          <p class="modal-device-sub">{{ selectedProduct.tag }} · 会员 {{ data?.discountLabel }} 折扣</p>
        </div>
      </div>
      <dl class="detail-list">
        <div class="detail-row"><dt>补给内容</dt><dd>{{ selectedProduct.desc }}</dd></div>
        <div class="detail-row"><dt>会员价</dt><dd>{{ money(selectedProduct.memberPriceCents) }} 星能</dd></div>
        <div class="detail-row"><dt>可用余额</dt><dd>{{ money(wallet.balanceCents) }} 星能</dd></div>
        <div class="detail-row"><dt>预计送达</dt><dd>1–3 个星际日</dd></div>
      </dl>
      <p class="card-note">
        <AppIcon name="spark" />
        <span>兑换后星能将立即扣除，物资进入跃迁队列；消费可累计 INU 粒子。</span>
      </p>
    </template>
    <template #footer>
      <button class="btn btn-ghost btn-sm" type="button" @click="orderOpen = false">取消</button>
      <button class="btn btn-primary btn-sm" type="button" :disabled="ordering" @click="confirmOrder">
        <span v-if="ordering" class="spinner" />
        {{ ordering ? '正在兑换…' : '确认兑换' }}
      </button>
    </template>
  </BaseModal>

  <BaseModal v-model="addressOpen" :title="address ? '编辑收货坐标' : '添加收货坐标'" width="480px">
    <form id="addressForm" @submit.prevent="saveAddress">
      <div class="form-grid">
        <div class="field">
          <label for="receiver">收货人</label>
          <input id="receiver" v-model="addressForm.receiver" class="input" type="text" maxlength="20" placeholder="星际旅人" />
        </div>
        <div class="field">
          <label for="addrPhone">手机号</label>
          <input id="addrPhone" v-model="addressForm.phone" class="input" type="tel" maxlength="11" placeholder="11 位手机号" />
        </div>
        <div class="field span-2">
          <label for="region">所在星域</label>
          <input id="region" v-model="addressForm.region" class="input" type="text" maxlength="30" placeholder="上海 · 中国" />
        </div>
        <div class="field span-2">
          <label for="detail">详细坐标</label>
          <input id="detail" v-model="addressForm.detail" class="input" type="text" maxlength="80" placeholder="浦东新区 · 星际港 7 号泊位" />
        </div>
      </div>
      <p v-if="addressError" class="form-error"><AppIcon name="shield" /><span>{{ addressError }}</span></p>
    </form>
    <template #footer>
      <button class="btn btn-ghost btn-sm" type="button" @click="addressOpen = false">取消</button>
      <button class="btn btn-primary btn-sm" type="submit" form="addressForm" :disabled="addressSaving">
        <span v-if="addressSaving" class="spinner" />
        {{ addressSaving ? '正在同步…' : '保存坐标' }}
      </button>
    </template>
  </BaseModal>

  <BaseModal v-model="detailOpen" title="补给订单详情" width="540px">
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
        <div v-if="!(detailOrder.timeline || []).length" class="quiet-text">物流轨迹正在同步。</div>
      </div>

      <dl class="detail-list">
        <div class="detail-row"><dt>星能消耗</dt><dd>{{ money(detailOrder.energyCents) }} 星能</dd></div>
        <div class="detail-row"><dt>运单号</dt><dd>{{ detailOrder.trackingNo || '待分配' }}</dd></div>
        <div class="detail-row"><dt>承运方</dt><dd>{{ detailOrder.carrier || '星际快递' }}</dd></div>
        <div v-if="detailOrder.address" class="detail-row">
          <dt>收货坐标</dt>
          <dd>{{ detailOrder.address.receiver }} · {{ maskPhone(detailOrder.address.phone) }} · {{ detailOrder.address.region }} {{ detailOrder.address.detail }}</dd>
        </div>
      </dl>
    </template>
    <template #footer>
      <button class="btn btn-ghost btn-sm" type="button" @click="detailOpen = false">关闭</button>
      <button
        v-if="detailOrder?.canCancel"
        class="btn btn-ghost btn-sm"
        type="button"
        :disabled="detailActionLoading"
        @click="cancelOrder(detailOrder)"
      >
        取消订单
      </button>
      <button
        v-if="detailOrder?.canPay"
        class="btn btn-primary btn-sm"
        type="button"
        :disabled="detailActionLoading"
        @click="payOrder(detailOrder)"
      >
        <span v-if="detailActionLoading" class="spinner" />
        去支付
      </button>
      <button
        v-if="detailOrder?.canConfirm"
        class="btn btn-primary btn-sm"
        type="button"
        :disabled="detailActionLoading"
        @click="confirmDelivery(detailOrder)"
      >
        <span v-if="detailActionLoading" class="spinner" />
        确认收货
      </button>
      <button
        v-if="detailOrder?.status === 'delivered' || detailOrder?.status === 'cancelled'"
        class="btn btn-primary btn-sm"
        type="button"
        @click="detailOpen = false; rebuy(detailOrder)"
      >
        再次购买
      </button>
    </template>
  </BaseModal>

  <BaseModal v-model="allOrdersOpen" title="全部补给订单" width="720px">
    <div v-if="allOrdersLoading" class="feed">
      <SkeletonBlock :rows="6" />
    </div>
    <div v-else class="table-wrap modal-orders">
      <table class="data-table responsive orders">
        <thead>
          <tr><th>订单</th><th>补给内容</th><th>星能</th><th>状态</th><th class="actions">操作</th></tr>
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
        <h3>还没有补给订单</h3>
        <p>兑换星际物资后，订单会出现在这里。</p>
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
