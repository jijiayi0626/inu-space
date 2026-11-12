<script setup>
import { computed, reactive, ref } from 'vue';
import { Button, FxField, Input, Select, Textarea } from 'fuxsto-design-pro';
import AppIcon from '../../components/AppIcon.vue';
import BaseModal from '../../components/BaseModal.vue';
import { api } from '../../lib/api';
import {
  ORDER_STATUS_OPTIONS,
  ORDER_STATUS_TONES,
  WITHDRAW_STATUS,
  orderStatusLabel,
} from '../../lib/adminHelpers';
import { dateTimeLabel, money } from '../../lib/format';
import { toast } from '../../lib/toast';

const props = defineProps({
  data: { type: Object, default: null },
  reload: { type: Function, required: true },
  askConfirm: { type: Function, required: true },
});

const finance = computed(() => props.data?.finance || {});
const orderList = computed(() => props.data?.orders || []);
const withdrawalList = computed(() => props.data?.withdrawals || []);
const rechargeList = computed(() => props.data?.recharges || []);
const orderStatusOptions = ORDER_STATUS_OPTIONS.map((item) => ({ label: item.label, value: item.key }));

/* ---------- 订单管理 ---------- */

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
    toast(result.refunded ? `订单已更新，已退回 ${money(result.refunded)} 余额` : '订单已更新');
    orderModal.value = false;
    await props.reload({ silent: true });
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
    toast(action === 'approve' ? '提现已通过，已标记为打款完成' : '提现已驳回，余额已退回用户钱包');
    withdrawModal.value = false;
    await props.reload({ silent: true });
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    withdrawBusy.value = false;
  }
}
</script>

<template>
  <section class="admin-section">
    <div class="admin-section-head">
      <div>
        <h2>财务与订单</h2>
        <p>用户余额、充值、订单与提现复核，所有金额以余额计。</p>
      </div>
    </div>

    <div class="finance-grid">
      <div class="admin-stat">
        <span class="admin-stat-icon is-blue"><AppIcon name="idcard" /></span>
        <div><strong>{{ money(finance.walletCents) }}</strong><span>用户余额总额</span></div>
      </div>
      <div class="admin-stat">
        <span class="admin-stat-icon is-green"><AppIcon name="star" /></span>
        <div><strong>{{ money(finance.rechargeCents) }}</strong><span>累计充值（{{ finance.rechargeCount || 0 }} 笔）</span></div>
      </div>
      <div class="admin-stat">
        <span class="admin-stat-icon is-purple"><AppIcon name="box" /></span>
        <div><strong>{{ money(finance.supplyCents) }}</strong><span>商品消费（{{ finance.orderCount || 0 }} 单）</span></div>
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
              {{ money(row.amountCents) }} 余额
              <span class="badge" :class="WITHDRAW_STATUS[row.status]?.tone || 'badge-gray'">{{ WITHDRAW_STATUS[row.status]?.label || row.status }}</span>
            </strong>
            <span>{{ row.userName }} · {{ row.userEmail }}</span>
            <em>{{ row.code }} · 收款账号 {{ row.account }} · {{ dateTimeLabel(row.createdAt) }}</em>
          </div>
          <div class="manage-actions">
            <Button variant="primary" size="sm" v-if="row.status === 'processing'" type="button" @click="openWithdraw(row)">处理</Button>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <h2>订单</h2>
        <span class="head-note">最近 20 笔</span>
      </div>

      <div v-if="!orderList.length" class="admin-empty compact">
        <span class="admin-empty-icon"><AppIcon name="box" /></span>
        <h3>还没有订单</h3>
        <p>用户在积分商城兑换商品后，订单会出现在这里。</p>
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
            <em>{{ money(order.energyCents) }} 余额 · {{ dateTimeLabel(order.createdAt) }}{{ order.trackingNo ? ` · ${order.carrier || '快递'} ${order.trackingNo}` : '' }}</em>
          </div>
          <div class="manage-actions">
            <Button variant="secondary" size="sm" type="button" @click="openOrderAdmin(order)">处理</Button>
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
              {{ money(row.amountCents) }} 余额
              <span class="badge" :class="row.status === 'paid' ? 'badge-green' : 'badge-orange'">{{ row.status === 'paid' ? '已到账' : row.status === 'pending' ? '待支付' : row.status }}</span>
            </strong>
            <span>{{ row.userName }} · {{ row.userEmail }}</span>
            <em>{{ row.code }} · {{ row.method || 'mock' }} · {{ dateTimeLabel(row.createdAt) }}</em>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- 订单处理 -->
  <BaseModal v-model="orderModal" title="处理订单" width="520px">
    <div v-if="orderTarget" class="modal-form">
      <div class="modal-summary">
        <strong>{{ orderTarget.item }}</strong>
        <span>{{ orderTarget.code }} · {{ orderTarget.userName }} · {{ money(orderTarget.energyCents) }} 余额</span>
      </div>
      <FxField v-select-label="'订单状态'" label="订单状态">
        <Select v-model="orderForm.status" :options="orderStatusOptions" />
        <p class="hint">取消已支付订单会自动把余额退回用户钱包；标记签收会通知用户。</p>
      </FxField>
      <div class="settings-fields">
        <div class="field">
          <span class="field-label">承运方</span>
          <Input aria-label="承运方" v-model="orderForm.carrier" maxlength="30" placeholder="例如：快递" />
        </div>
        <div class="field">
          <span class="field-label">运单号</span>
          <Input aria-label="运单号" v-model="orderForm.trackingNo" maxlength="60" placeholder="填写后通知用户物流更新" />
        </div>
      </div>
      <p v-if="orderError" class="modal-error">{{ orderError }}</p>
    </div>
    <template #footer>
      <Button variant="secondary" type="button" @click="orderModal = false">取消</Button>
      <Button variant="primary" type="button" :disabled="savingOrder" @click="submitOrder">
        <span v-if="savingOrder" class="spinner" />
        <span>{{ savingOrder ? '保存中…' : '保存订单状态' }}</span>
      </Button>
    </template>
  </BaseModal>

  <!-- 提现复核 -->
  <BaseModal v-model="withdrawModal" title="提现复核" width="500px">
    <div v-if="withdrawTarget" class="modal-form">
      <div class="modal-summary">
        <strong>{{ money(withdrawTarget.amountCents) }} 余额</strong>
        <span>{{ withdrawTarget.code }} · {{ withdrawTarget.userName }}</span>
        <span>收款账号：{{ withdrawTarget.account }}</span>
      </div>
      <div class="field">
        <span class="field-label">复核备注（可选）</span>
        <Textarea aria-label="复核备注（可选）" v-model="withdrawNote" :rows="3" :maxlength="200" placeholder="驳回时建议填写原因，会随站内信发送给用户。" />
      </div>
      <div class="modal-note warn">
        <AppIcon name="shield" />
        <p>通过后会标记为已打款；驳回会立即把余额退回用户钱包，无法撤回。</p>
      </div>
    </div>
    <template #footer>
      <Button variant="secondary" type="button" @click="withdrawModal = false">取消</Button>
      <Button variant="destructive" type="button" :disabled="withdrawBusy" @click="processWithdraw('reject')">驳回并退款</Button>
      <Button variant="primary" type="button" :disabled="withdrawBusy" @click="processWithdraw('approve')">
        <span v-if="withdrawBusy" class="spinner" />
        <span>{{ withdrawBusy ? '处理中…' : '通过并打款' }}</span>
      </Button>
    </template>
  </BaseModal>
</template>
