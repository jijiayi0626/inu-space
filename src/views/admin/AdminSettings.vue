<script setup>
import { computed, reactive, watch } from 'vue';
import AppIcon from '../../components/AppIcon.vue';
import { api } from '../../lib/api';
import { toast } from '../../lib/toast';

const props = defineProps({
  data: { type: Object, default: null },
  reload: { type: Function, required: true },
  askConfirm: { type: Function, required: true },
});

const settings = computed(() => props.data?.settings || {});

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
  () => props.data?.settings,
  (value) => {
    if (!value) return;
    siteForm.demoVisible = Boolean(value.demoVisible);
    siteForm.demoReadOnly = Boolean(value.demoReadOnly);
    siteForm.noticeEnabled = Boolean(value.noticeEnabled);
    siteForm.noticeText = value.noticeText || '';
    siteForm.noticeLevel = value.noticeLevel || 'info';
    siteForm.footerText = value.footerText || '';
    siteForm.loginWelcome = value.loginWelcome || '';
    siteForm.supportEmail = value.supportEmail || '';
    siteForm.walletCardLast4 = value.walletCardLast4 || '';
    siteForm.featureRecharge = Boolean(value.featureRecharge);
    siteForm.featureWithdraw = Boolean(value.featureWithdraw);
    siteForm.featurePhoneBind = Boolean(value.featurePhoneBind);
    siteForm.featureEmailChange = Boolean(value.featureEmailChange);
    siteForm.featureAvatar = Boolean(value.featureAvatar);
    siteForm.featureSupply = Boolean(value.featureSupply);
    siteForm.featureAgreements = Boolean(value.featureAgreements);
    siteForm.featureRegister = Boolean(value.featureRegister);
    siteForm.featureVerification = value.featureVerification !== false;
    siteForm.paymentMode = value.paymentMode || 'mock';
    siteForm.verificationMode = value.verificationMode || 'console';
    siteForm.rechargePresets = (value.rechargePresets || []).join(',');
    siteForm.withdrawMinYuan = Math.round((value.withdrawMinCents || 10000) / 100);
    siteForm.nameChangeDays = value.nameChangeDays ?? 30;
    siteForm.maintenanceEnabled = Boolean(value.maintenanceEnabled);
    siteForm.maintenanceText = value.maintenanceText || '';
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
    await props.reload({ silent: true });
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    siteForm.saving = false;
  }
}
</script>

<template>
  <section class="admin-section">
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
          <div><strong>演示账号</strong><span>{{ settings.demoEmail }}</span></div>
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
          <code>{{ settings.demoEmail }} · {{ settings.demoPassword }}</code>
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
</template>
