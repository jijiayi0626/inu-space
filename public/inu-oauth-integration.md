# INU 账号登录接入指南（AI 可直接执行）

> 本文档由「INU 账号中心」超级管理台生成，所有授权服务器地址已解析为：
>
> **{{INU_ORIGIN}}**
>
> 把这份文档交给 AI 时，请同时补充：**项目技术栈、回调地址、Client ID、Client Secret（仅机密客户端）**。AI 应按本文档直接修改代码、补环境变量、写测试，而不是只输出示例。

---

## 0. 给 AI 的任务说明（先读这一段）

你要在当前项目中接入「使用 INU 账号登录」（INU OAuth 2.0）。请严格执行：

1. 先扫描项目结构，找到现有的登录、会话、用户表、路由与页面组件，在现有架构内实现，不要另起一套框架。
2. 使用 **Authorization Code + PKCE（S256）** 流程。公开客户端（SPA / 移动端 / 无后端）必须使用 PKCE；机密客户端也建议使用 PKCE。
3. `state` 必须随机生成、保存在 HttpOnly 会话 Cookie 中、回调时一次性校验，禁止省略。
4. `client_secret` 只能放在服务端环境变量中，禁止出现在前端代码、浏览器请求、日志或 Git 仓库。
5. 用户唯一标识使用 userinfo 返回的 `sub`（INU ID）。不要把邮箱当作主键；只有 `email_verified === true` 时才可信任邮箱。
6. 接入完成后补充：环境变量示例、登录按钮、回调路由、退出时撤销令牌、失败提示、README 说明。
7. 运行项目的 lint / typecheck / build / 测试；如果失败，先修复再汇报。
8. 不要修改 INU 授权服务器的任何代码，也不要试图绕过 scope、redirect_uri 或 PKCE 校验。

### 需要向管理员获取的 4 项信息

| 配置项 | 说明 | 示例 |
| --- | --- | --- |
| `INU_CLIENT_ID` | 在 INU 超级管理台「应用接入」中创建应用后获得 | `inu_cl_xxxxxxxx` |
| `INU_CLIENT_SECRET` | 仅机密客户端需要，创建或重置时只显示一次 | `inu_cs_xxxxxxxx` |
| `INU_REDIRECT_URI` | 必须与后台登记的回调地址**完全一致** | `https://app.example.com/auth/inu/callback` |
| `INU_SCOPES` | 按需申请，至少 `profile`；需要邮箱再加 `email` | `profile email` |

> 如果管理员创建的是「公开客户端」，则没有 Client Secret，必须使用 PKCE。

---

## 1. 端点

| 用途 | 方法 | 地址 |
| --- | --- | --- |
| 授权页（浏览器跳转） | GET | `{{INU_ORIGIN}}/oauth/authorize` |
| 换取令牌（服务端） | POST | `{{INU_ORIGIN}}/oauth/token` |
| 读取用户资料 | GET | `{{INU_ORIGIN}}/oauth/userinfo` |
| 撤销令牌 | POST | `{{INU_ORIGIN}}/oauth/revoke` |
| 授权服务器元数据 | GET | `{{INU_ORIGIN}}/.well-known/oauth-authorization-server` |

元数据示例：

```json
{
  "issuer": "{{INU_ORIGIN}}",
  "authorization_endpoint": "{{INU_ORIGIN}}/oauth/authorize",
  "token_endpoint": "{{INU_ORIGIN}}/oauth/token",
  "userinfo_endpoint": "{{INU_ORIGIN}}/oauth/userinfo",
  "revocation_endpoint": "{{INU_ORIGIN}}/oauth/revoke",
  "scopes_supported": ["profile", "email"],
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code"],
  "code_challenge_methods_supported": ["S256"]
}
```

### 权限范围（scope）

| scope | 返回字段 | 说明 |
| --- | --- | --- |
| `profile` | `sub`、`name`、`preferred_username`、`inu_id`、`orbit`、`avatar_text`、`tier`、`tier_label` | 默认 scope。昵称、INU ID、账号编号、头像字符与会员等级 |
| `email` | `email`、`email_verified` | 邮箱与认证状态。未认证邮箱不要用于找回密码或账号合并 |

`sub` 始终返回，且是稳定的用户唯一标识。

---

## 2. 授权流程总览

```text
用户点击「使用 INU 账号登录」
        │
        ▼
应用生成 state + PKCE(verifier, challenge)
        │
        ▼
浏览器跳转 {{INU_ORIGIN}}/oauth/authorize?...
        │
        ├─ 未登录 → INU 登录页 → 登录
        ├─ 未授权 → INU  consent 页 → 用户同意
        ▼
302 回到 INU_REDIRECT_URI?code=...&state=...
        │
        ▼
应用校验 state → 服务端 POST /oauth/token
        │
        ▼
获得 access_token（1 小时有效，无 refresh_token）
        │
        ▼
GET /oauth/userinfo（Bearer Token）
        │
        ▼
用 sub 建立/查找本地用户 → 创建应用自己的会话
```

### 2.1 发起授权

浏览器跳转（参数必须 URL 编码）：

```text
{{INU_ORIGIN}}/oauth/authorize
  ?response_type=code
  &client_id={{CLIENT_ID}}
  &redirect_uri={{REDIRECT_URI}}
  &scope=profile%20email
  &state=<随机字符串>
  &code_challenge=<PKCE challenge>
  &code_challenge_method=S256
  &prompt=consent        # 可选：强制重新展示授权页
```

参数说明：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `response_type` | 是 | 固定 `code` |
| `client_id` | 是 | 应用 Client ID |
| `redirect_uri` | 是 | 必须与后台登记值完全一致（含协议、域名、端口、路径，不能多斜杠） |
| `scope` | 否 | 空格分隔，默认 `profile`；只允许 `profile`、`email` |
| `state` | 建议必填 | 随机值，回调时校验，防止 CSRF |
| `code_challenge` | 公开客户端必填 | PKCE challenge |
| `code_challenge_method` | 配合 PKCE | 固定 `S256` |
| `prompt` | 否 | `consent` 表示强制重新确认授权 |

### 2.2 生成 PKCE

```js
import crypto from 'node:crypto';

const verifier = crypto.randomBytes(48).toString('base64url'); // 43–128 字符
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
```

Python：

```python
import base64, hashlib, secrets

verifier = secrets.token_urlsafe(48)
challenge = base64.urlsafe_b64encode(
    hashlib.sha256(verifier.encode("ascii")).digest()
).rstrip(b"=").decode("ascii")
```

`verifier` 与 `state` 一起保存在服务端会话或 HttpOnly Cookie 中，回调时取出并删除。

### 2.3 回调处理

INU 会 302 回到：

```text
{{REDIRECT_URI}}?code=inu_ac_xxx&state=<原样返回>
```

失败时：

```text
{{REDIRECT_URI}}?error=access_denied&error_description=...&state=<原样返回>
```

回调端必须：

1. 校验 `state` 与本地保存值一致且未使用过；不一致立即拒绝。
2. 检查 `error` 参数，给用户可读提示，不要把原始错误直接抛到页面。
3. 取出 `code`，在后端用 `code_verifier` 换取令牌。
4. 换取成功后立即从会话中删除 `state`、`verifier`、`code`，防止重放。

### 2.4 换取令牌

`POST {{INU_ORIGIN}}/oauth/token`，`Content-Type: application/x-www-form-urlencoded`。

机密客户端（client_secret_post）：

```text
grant_type=authorization_code
&client_id={{CLIENT_ID}}
&client_secret={{CLIENT_SECRET}}
&code=<回调收到的 code>
&redirect_uri={{REDIRECT_URI}}
&code_verifier=<PKCE verifier>
```

机密客户端也支持 HTTP Basic：

```text
Authorization: Basic base64(client_id:client_secret)
```

公开客户端：不要发送 `client_secret`，但必须发送 `code_verifier`。

成功响应（HTTP 200）：

```json
{
  "access_token": "inu_at_xxxxxxxx",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "profile email"
}
```

注意：

- `access_token` 是不透明令牌，不是 JWT，**不要本地解析**，只能调用 userinfo。
- 有效期 1 小时，目前**没有 refresh_token**；过期后重新走授权流程即可。
- 授权码 5 分钟内有效、只能使用一次；`redirect_uri` 必须与授权请求完全一致。

### 2.5 读取用户资料

```bash
curl -H "Authorization: Bearer inu_at_xxxxxxxx" \
  {{INU_ORIGIN}}/oauth/userinfo
```

响应示例：

```json
{
  "sub": "INU-8F2A-9C31",
  "name": "小逸",
  "preferred_username": "小逸",
  "inu_id": "INU-8F2A-9C31",
  "orbit": "INU-8F2A-9C31",
  "avatar_text": "逸",
  "tier": "basic",
  "tier_label": "普通",
  "email": "user@example.com",
  "email_verified": true
}
```

字段说明：

| 字段 | scope | 说明 |
| --- | --- | --- |
| `sub` | 始终 | 稳定唯一标识，写入本地用户表的外部 ID 字段 |
| `name` / `preferred_username` | profile | 展示昵称 |
| `inu_id` | profile | INU 账号编号，与 `sub` 相同 |
| `orbit` | profile | 账号编号（兼容字段） |
| `avatar_text` | profile | 单字头像文本 |
| `tier` / `tier_label` | profile | 会员等级 key 与中文名 |
| `email` | email | 邮箱 |
| `email_verified` | email | 是否已验证；为 false 时不要信任该邮箱 |

### 2.6 退出登录与撤销

应用退出时，先撤销令牌，再清空本地会话：

```text
POST {{INU_ORIGIN}}/oauth/revoke
Content-Type: application/x-www-form-urlencoded

token=<access_token>
&client_id={{CLIENT_ID}}
&client_secret={{CLIENT_SECRET}}   # 机密客户端
```

撤销成功返回 `{"ok":true}`。撤销接口幂等：重复撤销或令牌不存在也返回成功。

---

## 3. 错误处理

### 3.1 授权回调错误（query 参数）

| `error` | 含义 | 建议处理 |
| --- | --- | --- |
| `access_denied` | 用户拒绝授权 | 提示「已取消登录」，停留在登录页 |
| `invalid_request` | 参数缺失或不合规 | 记录日志，提示稍后重试 |
| `invalid_scope` | 申请了不支持的 scope | 检查配置，只使用 `profile` / `email` |
| `unsupported_response_type` | 不是 code 模式 | 检查实现 |
| `invalid_client` | 应用不存在或被停用 | 联系 INU 管理员 |

### 3.2 Token / Revoke 错误（JSON）

HTTP 400/401，响应体：

```json
{
  "error": "invalid_grant",
  "error_description": "授权码无效、已使用或已过期"
}
```

| `error` | 常见原因 |
| --- | --- |
| `invalid_client` | Client ID/Secret 错误、应用被停用、公开客户端误传 secret |
| `invalid_grant` | code 过期/已用、redirect_uri 不一致、PKCE 校验失败、缺 code_verifier |
| `invalid_request` | 缺参数、Content-Type 错误 |
| `unsupported_grant_type` | 只支持 `authorization_code` |

### 3.3 UserInfo 错误

- 未带 Bearer Token：HTTP 401 `invalid_token`
- 令牌过期或已撤销：HTTP 401 `invalid_token`
- 处理方式：清除本地会话，引导用户重新登录。

---

## 4. 参考实现

### 4.1 Node.js / Express（机密客户端，服务端渲染或 BFF）

```js
import crypto from 'node:crypto';
import express from 'express';
import session from 'express-session';

const INU_ORIGIN = process.env.INU_ORIGIN;            // https://your-inu-origin
const CLIENT_ID = process.env.INU_CLIENT_ID;
const CLIENT_SECRET = process.env.INU_CLIENT_SECRET;
const REDIRECT_URI = process.env.INU_REDIRECT_URI;    // https://app.example.com/auth/inu/callback
const SCOPE = process.env.INU_SCOPES || 'profile email';

const app = express();
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: true },
}));

function base64url(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

app.get('/auth/inu/start', (req, res) => {
  const state = base64url(crypto.randomBytes(32));
  const verifier = base64url(crypto.randomBytes(48));
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

  req.session.inu = { state, verifier };

  const url = new URL(`${INU_ORIGIN}/oauth/authorize`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('scope', SCOPE);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');

  res.redirect(url.toString());
});

app.get('/auth/inu/callback', async (req, res) => {
  const saved = req.session.inu;
  delete req.session.inu;

  if (!saved || req.query.state !== saved.state) {
    return res.status(400).send('登录校验失败，请重新登录');
  }
  if (req.query.error) {
    return res.status(400).send(req.query.error === 'access_denied' ? '已取消登录' : 'INU 登录失败');
  }

  const tokenRes = await fetch(`${INU_ORIGIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: String(req.query.code || ''),
      redirect_uri: REDIRECT_URI,
      code_verifier: saved.verifier,
    }),
  });
  if (!tokenRes.ok) {
    console.error('INU token exchange failed', await tokenRes.text());
    return res.status(502).send('INU 登录暂时不可用');
  }
  const token = await tokenRes.json();

  const infoRes = await fetch(`${INU_ORIGIN}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!infoRes.ok) {
    console.error('INU userinfo failed', await infoRes.text());
    return res.status(502).send('无法读取 INU 用户资料');
  }
  const profile = await infoRes.json();

  // 推荐：用 sub 查找或创建本地用户
  // const user = await findOrCreateUser({ inuSub: profile.sub, name: profile.name, email: profile.email_verified ? profile.email : null });

  req.session.inuAccessToken = token.access_token;
  req.session.user = {
    sub: profile.sub,
    name: profile.name || profile.preferred_username || 'INU 用户',
    email: profile.email_verified ? profile.email : null,
    tier: profile.tier_label || '',
  };

  // 登录成功后轮换会话 ID，防止会话固定
  req.session.regenerate((err) => {
    if (err) return res.status(500).send('登录状态创建失败');
    req.session.user = {
      sub: profile.sub,
      name: profile.name || profile.preferred_username || 'INU 用户',
      email: profile.email_verified ? profile.email : null,
      tier: profile.tier_label || '',
    };
    res.redirect('/');
  });
});

app.post('/auth/logout', async (req, res) => {
  const token = req.session.inuAccessToken;
  if (token) {
    await fetch(`${INU_ORIGIN}/oauth/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    }).catch(() => {});
  }
  req.session.destroy(() => res.redirect('/'));
});
```

### 4.2 Next.js App Router（Route Handler）

`app/api/auth/inu/start/route.js`：

```js
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const state = crypto.randomBytes(32).toString('base64url');
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

  const cookieStore = await cookies();
  cookieStore.set('inu_oauth_state', state, { httpOnly: true, sameSite: 'lax', secure: true, maxAge: 600 });
  cookieStore.set('inu_oauth_verifier', verifier, { httpOnly: true, sameSite: 'lax', secure: true, maxAge: 600 });

  const url = new URL(`${process.env.INU_ORIGIN}/oauth/authorize`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', process.env.INU_CLIENT_ID);
  url.searchParams.set('redirect_uri', process.env.INU_REDIRECT_URI);
  url.searchParams.set('scope', process.env.INU_SCOPES || 'profile email');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return NextResponse.redirect(url);
}
```

`app/api/auth/inu/callback/route.js`：

```js
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const cookieStore = await cookies();
  const state = cookieStore.get('inu_oauth_state')?.value;
  const verifier = cookieStore.get('inu_oauth_verifier')?.value;
  cookieStore.delete('inu_oauth_state');
  cookieStore.delete('inu_oauth_verifier');

  if (!state || searchParams.get('state') !== state) {
    return NextResponse.redirect(new URL('/login?error=state', request.url));
  }
  if (searchParams.get('error')) {
    return NextResponse.redirect(new URL('/login?error=inu', request.url));
  }

  const tokenRes = await fetch(`${process.env.INU_ORIGIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.INU_CLIENT_ID,
      client_secret: process.env.INU_CLIENT_SECRET,
      code: searchParams.get('code') || '',
      redirect_uri: process.env.INU_REDIRECT_URI,
      code_verifier: verifier || '',
    }),
  });
  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL('/login?error=inu', request.url));
  }
  const token = await tokenRes.json();

  const infoRes = await fetch(`${process.env.INU_ORIGIN}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!infoRes.ok) {
    return NextResponse.redirect(new URL('/login?error=inu', request.url));
  }
  const profile = await infoRes.json();

  // TODO: 用 profile.sub 查找/创建本地用户，并创建自己的登录会话。
  // 不要在 URL 中暴露 access_token；只把 sub 写入你自己的会话。
  return NextResponse.redirect(new URL('/', request.url));
}
```

### 4.3 Python / FastAPI（机密客户端）

```python
import os, secrets, base64, hashlib
from urllib.parse import urlencode
import httpx
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import RedirectResponse
from starlette.middleware.sessions import SessionMiddleware

INU_ORIGIN = os.environ["INU_ORIGIN"]
CLIENT_ID = os.environ["INU_CLIENT_ID"]
CLIENT_SECRET = os.environ["INU_CLIENT_SECRET"]
REDIRECT_URI = os.environ["INU_REDIRECT_URI"]
SCOPE = os.environ.get("INU_SCOPES", "profile email")

app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key=os.environ["SESSION_SECRET"], same_site="lax", https_only=True)

@app.get("/auth/inu/start")
def start(request: Request):
    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode("ascii")).digest()
    ).rstrip(b"=").decode("ascii")
    request.session["inu_state"] = state
    request.session["inu_verifier"] = verifier

    query = urlencode({
        "response_type": "code",
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "scope": SCOPE,
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    })
    return RedirectResponse(f"{INU_ORIGIN}/oauth/authorize?{query}")

@app.get("/auth/inu/callback")
async def callback(request: Request, code: str = "", state: str = "", error: str = ""):
    saved_state = request.session.pop("inu_state", None)
    verifier = request.session.pop("inu_verifier", None)
    if not saved_state or state != saved_state:
        raise HTTPException(400, "登录校验失败")
    if error:
        raise HTTPException(400, "已取消登录" if error == "access_denied" else "INU 登录失败")

    async with httpx.AsyncClient(timeout=10) as client:
        token_res = await client.post(
            f"{INU_ORIGIN}/oauth/token",
            data={
                "grant_type": "authorization_code",
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "code": code,
                "redirect_uri": REDIRECT_URI,
                "code_verifier": verifier,
            },
        )
        token_res.raise_for_status()
        token = token_res.json()

        info_res = await client.get(
            f"{INU_ORIGIN}/oauth/userinfo",
            headers={"Authorization": f"Bearer {token['access_token']}"},
        )
        info_res.raise_for_status()
        profile = info_res.json()

    request.session["user"] = {
        "sub": profile["sub"],
        "name": profile.get("name") or profile.get("preferred_username"),
        "email": profile.get("email") if profile.get("email_verified") else None,
    }
    request.session["inu_access_token"] = token["access_token"]
    return RedirectResponse("/")
```

---

## 5. 数据模型建议

```sql
ALTER TABLE users ADD COLUMN inu_sub TEXT UNIQUE;
ALTER TABLE users ADD COLUMN inu_tier TEXT;
ALTER TABLE users ADD COLUMN inu_linked_at TIMESTAMP;
```

- 以 `inu_sub` 作为唯一索引，登录时先按 `inu_sub` 查找。
- 若按邮箱关联已有账号：只在 `email_verified === true` 且业务明确允许时自动绑定；否则要求用户登录原账号后手动绑定。
- 不要把 `access_token` 存进用户表；如需后台调用 INU API，可加密存储并记录过期时间（当前无 refresh token）。
- 记录 `tier` / `tier_label` 仅用于展示，不要作为本地权限判断的唯一依据。

---

## 6. 安全检查清单

- [ ] `state` 使用加密安全随机数，保存在 HttpOnly Cookie 或服务端会话，回调一次性校验。
- [ ] 公开客户端强制 PKCE（S256），`code_verifier` 不写入日志。
- [ ] `redirect_uri` 与后台登记值完全一致；生产环境只允许 HTTPS，不使用通配符。
- [ ] `client_secret` 只在服务端环境变量中；前端打包产物中搜索不到。
- [ ] 回调失败时返回统一错误页，不泄露 `code`、token 或堆栈。
- [ ] 登录成功后轮换会话 ID，旧会话立即失效（防会话固定）。
- [ ] 本地会话 Cookie 使用 `HttpOnly`、`SameSite=Lax`、`Secure`。
- [ ] 退出时调用 `/oauth/revoke`，并清空本地会话。
- [ ] 不把 `access_token` 放进 URL、localStorage 或前端日志。
- [ ] 只信任 `email_verified === true` 的邮箱。
- [ ] 对回调接口做限流与异常监控。
- [ ] 演示账号为只读模式，不要用它做自动化写入测试。

---

## 7. 验收标准

完成接入后，逐项验证：

- [ ] 未登录用户点击「使用 INU 账号登录」，能跳转到 INU 登录页。
- [ ] 登录并同意授权后，能回到应用回调地址，且 `state` 校验通过。
- [ ] 伪造/重复 `state` 会被拒绝。
- [ ] 用户拒绝授权时，应用显示友好提示，不创建会话。
- [ ] 回调后能成功换取 access_token，并调用 userinfo 读取 `sub` 与昵称。
- [ ] 应用用 `sub` 建立本地用户与会话，刷新页面后仍保持登录。
- [ ] 只申请 `profile` 时，userinfo 不返回邮箱；申请 `email` 时返回 `email` 与 `email_verified`。
- [ ] 令牌过期或撤销后，应用能清除会话并引导重新登录。
- [ ] 退出登录会调用 `/oauth/revoke`，再次使用旧 token 调用 userinfo 返回 401。
- [ ] 移动端与桌面端登录按钮、回调页、错误提示均正常。
- [ ] `npm run build` / 项目测试全部通过，前端产物中无 `client_secret`。

---

## 8. AI 执行顺序（建议）

1. 阅读项目，列出需要修改的文件：登录页、路由、会话中间件、用户模型、环境变量示例、README。
2. 新增环境变量：`INU_ORIGIN`、`INU_CLIENT_ID`、`INU_CLIENT_SECRET`、`INU_REDIRECT_URI`、`INU_SCOPES`。
3. 实现 `/auth/inu/start` 与 `/auth/inu/callback`（名称可按项目规范调整）。
4. 在登录页新增「使用 INU 账号登录」按钮，链接到 start 路由。
5. 实现 userinfo → 本地用户 → 会话的映射；补数据库迁移。
6. 实现退出时撤销令牌。
7. 增加错误提示与日志（不要记录 token、code、client_secret）。
8. 运行 lint、typecheck、build、测试；修复所有问题。
9. 输出变更清单、环境变量清单、测试结果与仍需管理员确认的事项。

---

## 9. 常见问题

**Q：Token 过期了怎么办？**
当前不支持 refresh_token。清除本地会话，让用户重新点击「使用 INU 账号登录」即可；授权页通常会记住上次授权，用户无需重复勾选。

**Q：可以只用邮箱登录吗？**
不建议。`sub` 才是稳定唯一标识；邮箱可能变更，且必须 `email_verified === true` 才可信。

**Q：公开客户端能否直接在前端换 token？**
技术上 token 端点允许公开客户端 + PKCE 直接调用，但更推荐由后端（BFF）完成换取与 userinfo，避免令牌暴露在浏览器。

**Q：回调地址可以填多个吗？**
INU 后台支持为一个应用登记多个回调地址，但每次授权请求的 `redirect_uri` 必须与其中某一个完全一致。GitHub 第三方登录的回调限制不适用于 INU OAuth 应用。

**Q：如何强制用户重新确认授权？**
在授权 URL 增加 `prompt=consent`。

---

*文档版本：2026-10 · 由 INU 超级管理台生成。授权服务器地址：{{INU_ORIGIN}}*
