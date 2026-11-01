<script setup>
import { computed } from 'vue';
import AppIcon from '../../components/AppIcon.vue';
import { copyText } from '../../lib/adminHelpers';
import { toast } from '../../lib/toast';

const props = defineProps({
  data: { type: Object, default: null },
  reload: { type: Function, required: true },
  askConfirm: { type: Function, required: true },
});

const endpoints = computed(() => props.data?.endpoints || {});
const scopes = computed(() => props.data?.scopes || []);

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
</script>

<template>
  <section class="admin-section">
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
</template>
