# INU 账号中心

Vue 3 + Cloudflare Workers + D1 实现的「INU」账号中心。包含账号业务页面、登录鉴权、真实的 D1 数据读写、会员/协议/积分商城业务流程、第三方授权管理，以及一套可直接部署到 Cloudflare 的工程结构。

在此之上还实现了：

- **完整业务闭环**：余额钱包充值 / 提现、积分商城订单支付 / 取消 / 确认收货 / 再次购买、协议模板与签署快照导出、通知收件箱与全站广播、手机号 / 邮箱绑定、真实头像配色、密码找回申请与管理员重置。
- **超级管理台** `/admin`：配置 GitHub / Google 登录方式、管理第三方 OAuth 应用、站点功能开关、商品与协议内容、订单与提现复核、用户管理与密码重置、审计日志与管理员。
- **INU OAuth 2.0 身份提供方**：其他应用可以用「使用 INU 账号登录」接入，支持授权码模式、PKCE、userinfo 与令牌撤销。

演示账号：`xiaoyiyi@inu.space` / `inu2026`（默认不在登录页展示，且为只读模式；可在管理台调整）

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | Vue 3 `<script setup>`、Vue Router 4、Vite 8 |
| 后端 | Hono 4（Cloudflare Workers） |
| 数据库 | Cloudflare D1（SQLite） |
| 部署 | Workers Static Assets + Wrangler 4 |
| 鉴权 | HttpOnly Cookie Session + PBKDF2-SHA256 + D1 会话表 |
| 设计系统 | Fuxsto Design Pro 0.1.5 + lucide-vue-next |

## 设计系统

界面基于 [Fuxsto Design Pro](https://pro.design.fuxsto.com/) 0.1.5，并完成组件级接入：按钮、输入框、文本域、下拉选择、开关、复选框、对话框与轻提示全部使用库组件；颜色、圆角、阴影、间距、字号与动效均使用 `--fx-*` 令牌。主题为蓝紫品牌色（亮色 `#5B97FF`，暗色 `#89B4FF`），`FxConfigProvider` 统一管理主题、动效与减少动态效果偏好，业务图标使用 lucide 线性图标。

样式导入顺序为 `layers.css` → 库 `styles.css` → `base.css`，通过 `@layer reset, theme, components, app` 固定层叠优先级，避免重置样式压过组件样式。项目约定与设计细则见 `AGENTS.md`、`docs/design-rules.md` 与 `docs/product-principles.md`，每次开发前优先阅读。

## 功能

- **总览**：余额钱包、积分、会员进度、快捷入口、最近动态；钱包卡片可直接进入充值 / 提现。
- **个人资料**：昵称/邮箱/签名修改、头像配色、INU ID 复制、手机号与邮箱验证码绑定（控制台验证码模式）、实名认证。
- **账户安全**：安全评分、两步验证开关、登录保护策略、密码修改、安全日志（支持分页 / 筛选）。
- **授权应用**：独立页面展示通过「使用 INU 账号登录」授权的第三方应用、权限范围、有效期与最近使用时间，可一键撤销授权并吊销令牌。
- **登录设备**：受信设备、活跃会话与 UA 解析（系统 / 浏览器 / 机型）、按会话退出、新增设备、解绑、退出其他设备、登录记录。
- **通知偏好**：通知类型、渠道开关、免打扰时段、每周摘要，以及站内信收件箱（标记已读 / 全部已读 / 删除）。
- **会员中心**：等级进度、四档会员权益、积分流水（分页）。
- **协议中心**：协议列表、正文详情、待签署提醒、签署时写入协议快照、签署后发放 50 积分、已签协议导出文本。
- **积分商城**：会员价商品、余额兑换下单、订单详情与物流时间线、待支付订单支付 / 取消、确认收货、再次购买、收货地址。
- **余额钱包**：充值（模拟支付 / 关闭）、提现申请（管理员复核）、钱包流水、充值订单状态。
- **找回密码**：登录页提交找回申请，管理员在「用户管理」中重置密码并标记处理。
- **超级管理台**：登录方式配置、OAuth 应用与密钥管理、站点功能开关、商品与协议模板、全站广播、财务与订单复核、用户搜索与调整、密码重置、接入指引、审计日志、管理员授权。
- **INU 授权登录**：第三方应用通过 `/oauth/authorize` 获取授权码，兑换令牌后读取用户资料。

> 「实名认证」提供两种模式：`console`（控制台输出验证码，开发 / 演示）与 `off`（关闭）。生产环境请接入真实的实名 / 活体核验服务。支付当前为模拟模式，接入真实支付渠道后可保持同一套订单与流水结构。

## 本地运行

```bash
npm install

# 本地环境变量：填写 CONFIG_KEY（管理台密钥加密用）
# 需要超级管理员时再填 ADMIN_EMAILS
cp .dev.vars.example .dev.vars

# 生成本地 CONFIG_KEY
openssl rand -base64 32

# 初始化本地 D1（建表 + 演示数据 + OAuth + 管理台）
npm run db:local

# 构建前端，再由 Worker 同时托管静态资源与 /api
npm run build
npm run worker:dev
# http://127.0.0.1:8787
```

本地把 `ADMIN_EMAILS=xiaoyiyi@inu.space` 写入 `.dev.vars` 后，演示账号登录即拥有超级管理员权限；不要把演示账号用作生产管理员。

前后端分离调试（可选）：

```bash
npm run worker:dev   # 设备 1，API 在 8787
npm run dev          # 设备 2，Vite 在 5173，/api 已代理到 8787
```

## 部署到 Cloudflare

1. 登录 Wrangler：

   ```bash
   npx wrangler login
   ```

2. 创建 D1 数据库：

   ```bash
   npx wrangler d1 create inu-space-db
   ```

   把命令输出的 `database_id` 写入 `wrangler.jsonc`，替换占位值
   `00000000-0000-0000-0000-000000000000`。

3. 初始化远程库：

   ```bash
   # 首次部署：建表 + 演示数据 + OAuth + 管理台 + 功能表
   npm run db:remote

   # 已有数据的库升级：执行 0001 与 0003–0009，不会重置演示账号
   npm run db:migrate:remote
   ```

   `0005_features.sql` 与 `0008_session_names.sql` 含 `ALTER TABLE`，对已升级过的库重复执行会报「duplicate column」，可跳过已执行过的文件；`0007_neutral_tiers.sql` 与 `0009_neutral_content.sql` 是数据更新，可安全重复执行。

4. 配置 Worker 密钥：

   ```bash
   # 管理台保存第三方登录密钥时需要，缺失将无法在后台保存 Secret
   npx wrangler secret put CONFIG_KEY

   # 可选：生产环境直接授予超级管理员的邮箱（逗号分隔）
   npx wrangler secret put ADMIN_EMAILS

   # 可选：不希望在管理台填写时，也可继续用环境变量提供社交登录
   npx wrangler secret put GITHUB_CLIENT_ID
   npx wrangler secret put GITHUB_CLIENT_SECRET
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   ```

   `CONFIG_KEY` 用于 AES-GCM 加密保存在 D1 的 Client Secret，生成方式：
   `openssl rand -base64 32`。部署后也可在管理台「登录方式」里填写 GitHub / Google 的 Client ID 与 Secret，保存后立即生效，无需重新部署。

5. 构建并部署：

   ```bash
   npm run deploy
   ```

6. 首次进入 `/admin` 需要超级管理员。二选一：

   - 部署前设置 `ADMIN_EMAILS`，对应邮箱注册/登录后自动获得权限；
   - 或登录一次后，在 D1 中手动授权：

     ```sql
     INSERT OR IGNORE INTO admin_users (user_id, granted_by, created_at)
     SELECT id, 'manual', datetime('now') FROM users WHERE email = 'you@example.com';
     ```

   **不要**把演示账号 `xiaoyiyi@inu.space` 设为生产管理员。

7. 打开 `https://pass.inumc.dpdns.org`（`wrangler.jsonc` 已绑定自定义域）。
   也可以在 `https://inu-space-pass.<你的子域>.workers.dev` 访问；自定义域可在
   Cloudflare 控制台 → Workers & Pages → `inu-space-pass` → Settings → Domains & Routes 调整。

### 上线前必做

- 演示账号默认不在登录页展示且为只读模式；如不需要，可继续隐藏入口，或修改密码 / 删除演示账号。
- 如面向公网，把 `verification_mode` 设为 `off` 或接入真实实名服务，避免控制台验证码模式被滥用。
- 在 Workers Paid 方案下，将 `worker/index.js` 的 `PBKDF2_ITERATIONS` 提高到
  `100000` 以上（哈希串内已记录迭代次数，调整后旧密码仍可验证，用户下次改密时自动升级）。
- 支付当前为 `payment_mode=mock` 模拟模式；接入真实支付渠道时，在 `/api/wallet/recharge/:id/pay` 与 `/api/supply/orders/:id/pay` 中替换为支付网关回调，并保持订单 / 流水表结构不变。
- 提现为「用户申请 → 管理员复核（通过并打款 / 驳回并退款）」流程，生产环境请结合真实结算渠道与风控。

## 超级管理台

访问 `/admin`，只有超级管理员可见入口。管理员来源有两类：

- `ADMIN_EMAILS` 环境变量中的邮箱，登录或访问 `/api/me` 时自动写入 `admin_users`；
- 已登录的管理员在「管理员」分区按邮箱授予，或直接在 D1 的 `admin_users` 中插入。

管理台包含：

| 分区 | 能力 |
| --- | --- |
| 登录方式 | 配置 GitHub / Google 的 Client ID、Client Secret、启用状态，保存即生效 |
| 站点设置 | 演示账号入口显隐与只读、站点公告、欢迎语与页脚、客服邮箱与钱包卡号尾号、9 项功能开关、支付 / 验证模式、充值预设、提现门槛、改名冷却、维护模式 |
| 内容与商品 | 全站广播（按通知偏好送达站内信）、积分商城商品增删改（名称、价格、会员价、库存、图标、色系、上下架）、协议模板增删改（标题、版本、正文、奖励积分、启用状态） |
| 财务与订单 | 收入 / 支出 / 待复核提现 / 订单数统计、提现复核（通过并打款 / 驳回并退款）、订单状态与物流（承运商、单号、时间线）、充值订单列表 |
| 用户管理 | 用户搜索（邮箱 / 昵称 / INU ID / 手机号）、认证与管理员标记、积分与余额增减、昵称修改、重置登录密码、处理密码找回申请 |
| 应用接入 | 创建、编辑、停用、删除 OAuth 应用，重置 Client Secret，配置回调地址与权限范围 |
| 接入指引 | 展示端点、scope、接入步骤和服务端示例代码，可下载 / 复制 AI 可直接执行的 Markdown 接入文档 |
| 审计日志 | 记录创建/删除应用、重置密钥、修改登录方式、更新站点设置、商品与模板变更、广播、订单 / 提现处理、用户调整、授予/移除管理员等操作 |
| 管理员 | 按邮箱授予或移除超级管理员，内置「至少保留一名管理员」与禁止自我移除保护 |

每个分区都有独立地址：`/admin/providers`、`/admin/settings`、`/admin/content`、`/admin/finance`、`/admin/users`、`/admin/clients`、`/admin/access`、`/admin/audit`、`/admin/admins`。`/admin` 会跳转到登录方式，侧边栏在管理台内展开全部分区，便于直接跳转和收藏。

保存在 D1 的社交登录 Secret 使用 `CONFIG_KEY` 派生的 AES-GCM 密钥加密，管理接口永远不会回传明文。未设置 `CONFIG_KEY` 时，管理台只能保留已有密钥，不能写入新的 Secret。第三方应用的 Client Secret 只在创建和轮换时显示一次，D1 仅保存 SHA-256 摘要。

### 站点设置与演示账号

站点设置保存在 `app_settings` 表的 `site.*` 键中，无需新增迁移。默认值：

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `site.demo_visible` | `0` | 登录页不展示演示入口；手动输入演示账号仍可登录 |
| `site.demo_readonly` | `1` | 演示账号的所有写操作由服务端拒绝，仅允许浏览、登录、退出与 OAuth 授权 |
| `site.notice_enabled` | `0` | 站点公告开关 |
| `site.notice_text` | 空 | 公告内容，最多 200 字 |
| `site.notice_level` | `info` | `info` / `success` / `warn` |
| `site.footer_text` | `© 2026 INU · INU 账号` | 登录页与内页页脚 |
| `site.login_welcome` | `使用你的 INU 个人资料继续旅程。` | 登录页欢迎语 |
| `site.support_email` | `support@inu.space` | 客服邮箱（登录页找回密码与帮助入口） |
| `site.wallet_card_last4` | `0721` | 钱包卡片尾号展示 |
| `site.feature_recharge` | `1` | 余额充值开关，关闭后 `/api/wallet/recharge` 返回功能关闭 |
| `site.feature_withdraw` | `0` | 提现开关，默认关闭 |
| `site.feature_phone_bind` | `1` | 手机号绑定与解绑 |
| `site.feature_email_change` | `1` | 邮箱换绑 |
| `site.feature_avatar` | `1` | 头像配色修改 |
| `site.feature_supply` | `1` | 积分商城下单（关闭后仅可浏览） |
| `site.feature_agreements` | `1` | 协议签署（关闭后仅可浏览） |
| `site.feature_register` | `0` | 开放邮箱自助注册 |
| `site.feature_verification` | `1` | 实名用户实名认证入口；关闭后认证按钮显示「认证通道已关闭」，服务端拒绝认证、下单与提现 |
| `site.payment_mode` | `mock` | `mock` 模拟支付 / `off` 关闭在线支付 |
| `site.verification_mode` | `console` | `console` 返回验证码 devCode 并开放模拟认证 / `off` 关闭验证码与模拟认证 |
| `site.recharge_presets` | `50,100,200,500,1000` | 充值金额预设（元，1–8 个） |
| `site.withdraw_min_cents` | `10000` | 最低提现金额（分） |
| `site.name_change_days` | `30` | 昵称修改冷却天数，`0` 表示不限制 |
| `site.maintenance_enabled` | `0` | 维护模式，非管理员访问业务接口返回维护提示 |
| `site.maintenance_text` | 空 | 维护提示文案 |

功能开关与站点设置会通过 `/api/auth/providers` 的 `site.features` / `site.wallet` 字段下发给前端，未开放的功能在页面上隐藏或禁用，服务端同时校验，不能靠改前端绕过。

演示密码不会写进前端静态包：只有 `site.demo_visible=1` 时，`/api/auth/providers` 才会返回演示凭据供登录页预填；关闭后接口与页面都不再出现演示密码。只读模式下服务端对演示账号的非 GET 请求返回 `403 DEMO_READONLY`，并在页面顶部展示只读提示。

## 用 INU 账号登录（OAuth 2.0 身份提供方）

INU 同时是一个标准的 OAuth 2.0 授权服务器。第三方应用把用户引导到 `/oauth/authorize`，用户同意后应用用授权码换取 `access_token`，再调用 `/oauth/userinfo` 获取资料。

### 端点

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/oauth/authorize` | 授权入口，校验 client、redirect_uri、scope、PKCE 后跳转同意页 |
| POST | `/oauth/token` | 用授权码换令牌，支持 `client_secret_basic` / `client_secret_post` |
| GET | `/oauth/userinfo` | Bearer Token 读取用户资料 |
| POST | `/oauth/revoke` | 撤销 access_token |
| GET | `/.well-known/oauth-authorization-server` | 授权服务器元数据 |

### 接入步骤

1. 在管理台「应用接入」创建应用，填写回调地址和 scope，保存返回的 `client_id` 与 `client_secret`（Secret 只显示一次）。
2. 生成 `state` 与 PKCE 参数，把用户引导到：

   ```text
   /oauth/authorize?response_type=code&client_id=...&redirect_uri=...&scope=profile%20email&state=...&code_challenge=...&code_challenge_method=S256
   ```

3. 用户同意后回调到 `redirect_uri?code=...&state=...`。服务端用授权码换令牌：

   ```bash
   curl -X POST https://<你的域名>/oauth/token \
     -u "$CLIENT_ID:$CLIENT_SECRET" \
     -d grant_type=authorization_code \
     -d code="$CODE" \
     -d redirect_uri="$REDIRECT_URI" \
     -d code_verifier="$CODE_VERIFIER"
   ```

4. 用 `Authorization: Bearer <access_token>` 请求 `/oauth/userinfo`。

### 规则

- 授权码有效期 5 分钟，只能使用一次；`access_token` 有效期 1 小时，不提供 refresh token。
- 机密客户端可使用 Client Secret 认证；公开客户端（SPA、移动应用）不保存 Secret，必须使用 PKCE `S256`。
- `redirect_uri` 必须与管理台登记的地址完全一致；仅允许 `https://`，本地调试可用 `http://localhost` / `http://127.0.0.1`。
- scope 目前支持 `profile`（昵称、INU ID、账号编号、会员等级、头像字符）与 `email`（邮箱和认证状态）。
- 已授权过的应用默认跳过同意页；使用 `prompt=consent` 可强制重新展示。
- `userinfo` 的 `sub` 是 INU 用户 ID；`email_verified` 表示该账号已通过 INU 的实名认证，不表示邮箱控制权验证。

### AI 接入文档

管理台「接入指引」提供「下载 MD / 复制全文」，会把实际授权服务器地址写入 `public/inu-oauth-integration.md` 后导出为 Markdown。文档覆盖端点、PKCE、令牌交换、userinfo 字段、错误处理、安全清单、验收标准，以及 Node.js / Next.js / FastAPI 参考实现，可直接交给其他项目的 AI 执行接入。

原始模板位于 `public/inu-oauth-integration.md`，构建后会随静态资源一起部署，也可直接访问 `/inu-oauth-integration.md`。模板中的 `{{INU_ORIGIN}}` 会在管理台下载时替换为当前站点地址。

## GitHub / Google 登录（登录 INU 用）

登录页支持 GitHub（主）与 Google（备用）。未配置的提供方会自动隐藏，邮箱密码登录不受影响。

生产回调地址（以当前域名为例，绑定其它域名时同步替换）：

```text
https://pass.inumc.dpdns.org/api/auth/oauth/github/callback
https://pass.inumc.dpdns.org/api/auth/oauth/google/callback
```

本地调试使用 `http://127.0.0.1:8787/api/auth/oauth/<provider>/callback`。GitHub OAuth App 只允许一个回调地址，本地调试时需要临时替换；Google 可同时添加多个。

配置方式二选一：

- 部署后进入 `/admin` →「登录方式」填写并启用，保存立即生效；
- 或在 Worker 环境变量中设置 `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`。

行为说明：

- 只接受提供方返回的**已验证邮箱**；没有验证邮箱会拒绝登录。
- 邮箱已存在时自动绑定到该用户，不重复建号；否则创建新用户（无可用密码，只能走第三方登录）。
- `state` 存在 HttpOnly Cookie 中；Google 额外使用 PKCE（S256）。回调校验失败会回到登录页提示。
- 绑定关系存于 `oauth_accounts`（`migrations/0003_oauth.sql`），同一 `provider + subject` 唯一。

## 钱包、订单与找回密码

- **充值**：`POST /api/wallet/recharge` 创建充值单，金额 10–50000 余额，支付方式 `inu_pay` / `alipay` / `wechat`。`mock` 模式下立即入账并写入 `wallet_transactions`；`off` 模式下接口返回 `PAYMENT_UNAVAILABLE`。
- **提现**：要求已完成实名认证并绑定手机号，单次不低于 `site.withdraw_min_cents`。申请时冻结扣减余额，状态为 `processing`；管理员「通过并打款」后变为 `paid`，「驳回并退款」会把金额退回余额并记流水。
- **订单**：状态为 `pending_payment` / `transit` / `delivered` / `cancelled`。待支付可支付或取消，支付扣减余额并写流水；管理员可在财务页填写承运商、运单号并推进物流时间线；用户确认收货或再次购买（生成新订单）。
- **验证码**：手机号绑定、邮箱换绑使用 6 位验证码，10 分钟有效、最多尝试 5 次、每小时最多 5 条；`console` 模式会直接返回 `devCode` 供联调，关闭后接口拒绝。
- **密码找回**：登录页提交邮箱后生成 `password_reset_requests` 记录（10 分钟内去重）并通知管理员；管理员在「用户管理」中重置密码后，待处理申请自动标记为已处理。接口对邮箱是否存在都返回同一句话，避免账号枚举。

## API

所有 `/api/*` 响应均为 `private, no-store`。除登录、注册、找回密码、社交登录回调、提供方状态等公开端点外，其余接口都需要登录态；`/api/admin/*` 还需要超级管理员权限。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/login` | 邮箱密码登录，失败 5 次锁定 15 分钟 |
| POST | `/api/auth/register` | 自助注册（受 `site.feature_register` 控制），注册后自动登录 |
| POST | `/api/auth/password-reset` | 提交密码找回申请（公开，统一返回，不暴露邮箱是否存在） |
| POST | `/api/auth/logout` | 退出并清除会话 |
| GET | `/api/auth/providers` | 社交登录提供方启用状态与公开站点设置（公开） |
| GET | `/api/auth/oauth/:provider/start` | 发起 GitHub / Google 登录（公开） |
| GET | `/api/auth/oauth/:provider/callback` | 社交登录回调（公开） |
| GET | `/api/me` | 当前用户 |
| GET | `/api/overview` | 总览聚合数据 |
| GET | `/api/overview/activities` | 最近动态分页 |
| GET / PATCH | `/api/profile` | 读取 / 更新资料（昵称受冷却限制） |
| POST | `/api/profile/avatar` | 更换头像配色 |
| POST | `/api/profile/phone/code`、`/api/profile/phone/verify` | 发送 / 校验绑定手机验证码 |
| DELETE | `/api/profile/phone` | 解绑手机号（需密码） |
| POST | `/api/profile/email/code`、`/api/profile/email/verify` | 发送 / 校验换绑邮箱验证码 |
| POST | `/api/profile/verify` | 实名认证（受 `site.verification_mode` 控制） |
| GET | `/api/security` | 安全评分、凭证、策略、日志与已授权应用（`connections`） |
| GET | `/api/security/connections` | 已授权应用独立接口（授权范围、最近使用、有效令牌数） |
| GET | `/api/security/logs` | 安全日志分页 |
| POST | `/api/security/2fa` | 两步验证开关 |
| PATCH | `/api/security/guards` | 登录保护开关 |
| POST | `/api/security/password` | 修改密码并吊销其它会话 |
| DELETE | `/api/security/connections/:clientId` | 撤销第三方应用授权（吊销全部令牌） |
| GET | `/api/devices` | 受信设备、登录记录与活跃会话（`sessions`，含 UA 解析） |
| GET | `/api/devices/logs` | 登录记录分页 |
| POST | `/api/devices` | 新增受信设备 |
| POST | `/api/devices/:id/unbind` | 解绑设备 |
| POST | `/api/devices/sessions/:id/revoke` | 退出指定的其它活跃会话 |
| POST | `/api/devices/logout-others` | 退出其余会话 |
| GET | `/api/notifications` | 通知偏好聚合 |
| GET | `/api/notifications/messages` | 站内信列表（分页 / 未读筛选） |
| POST | `/api/notifications/messages/:id/read`、`/read-all` | 标记已读 / 全部已读 |
| DELETE | `/api/notifications/messages/:id` | 删除站内信 |
| PATCH | `/api/notifications/prefs` | 更新通知类型/渠道 |
| PATCH | `/api/notifications/settings` | 免打扰与摘要 |
| GET | `/api/member` | 会员等级、权益、积分流水 |
| GET | `/api/member/particles` | 积分流水分页 |
| GET | `/api/agreements` | 协议列表 |
| GET | `/api/agreements/:id` | 协议正文与签署状态 |
| GET | `/api/agreements/:id/export` | 导出已签协议文本（含快照） |
| POST | `/api/agreements/:id/sign` | 签署协议 +50 积分 |
| GET | `/api/supply` | 积分商城聚合数据 |
| GET | `/api/supply/orders`、`/api/supply/orders/:id` | 订单列表 / 详情与物流 |
| POST | `/api/supply/orders` | 余额兑换下单 |
| POST | `/api/supply/orders/:id/pay` | 支付待支付订单 |
| POST | `/api/supply/orders/:id/cancel` | 取消待支付订单并退款 |
| POST | `/api/supply/orders/:id/confirm` | 确认收货 |
| POST | `/api/supply/orders/:id/rebuy` | 按原商品再次购买 |
| PATCH | `/api/supply/address` | 保存收货地址 |
| GET | `/api/wallet` | 余额、流水、充值单、提现单与开关 |
| POST | `/api/wallet/recharge` | 创建充值单（mock 模式立即到账） |
| POST | `/api/wallet/recharge/:id/pay`、`/cancel` | 支付 / 取消充值单 |
| POST | `/api/wallet/withdraw` | 提交提现申请（冻结余额，等待复核） |
| GET | `/api/oauth/authorize/context` | 读取授权请求、用户与 scope（需登录） |
| POST | `/api/oauth/authorize/decision` | 同意 / 拒绝授权并签发授权码 |
| GET | `/api/admin` | 管理台聚合数据（管理员） |
| PATCH | `/api/admin/settings` | 保存站点设置与功能开关（管理员） |
| PATCH | `/api/admin/providers/:id` | 保存 GitHub / Google 登录配置（管理员） |
| POST | `/api/admin/oauth-clients` | 创建 OAuth 应用（管理员） |
| PATCH / DELETE | `/api/admin/oauth-clients/:id` | 编辑 / 删除 OAuth 应用（管理员） |
| POST | `/api/admin/oauth-clients/:id/rotate-secret` | 重置 Client Secret（管理员） |
| POST / PATCH / DELETE | `/api/admin/products`、`/api/admin/products/:id` | 积分商城商品增删改（管理员） |
| POST / PATCH / DELETE | `/api/admin/agreement-templates`、`/:id` | 协议模板增删改（管理员） |
| POST | `/api/admin/notifications` | 全站广播站内信（管理员） |
| PATCH | `/api/admin/orders/:id` | 更新订单状态、承运商、运单号与时间线（管理员） |
| PATCH | `/api/admin/withdrawals/:id` | 提现复核：通过并打款 / 驳回并退款（管理员） |
| GET / PATCH | `/api/admin/users`、`/api/admin/users/:id` | 用户搜索 / 调整资料、积分余额、重置密码（管理员） |
| PATCH | `/api/admin/password-resets/:id` | 标记密码找回申请已处理（管理员） |
| GET | `/api/admin/audit` | 审计日志（管理员） |
| POST / DELETE | `/api/admin/admins`、`/api/admin/admins/:userId` | 授予 / 移除管理员（管理员） |

## 请求次数优化

页面数据按「一页一接口」聚合：打开一个页面只产生 1 次 `/api` 请求。前端 `src/lib/api.js` 还有：

- GET 结果内存缓存 30 秒；
- 并发相同请求自动合并（in-flight dedupe）；
- 任意写操作后清空缓存，保证数据一致；
- 通过 `run_worker_first: ["/api/*", "/oauth/*", "/.well-known/*"]` 让 API 与 OAuth 端点进入 Worker，其余静态资源留在边缘；
- D1 为会话、日志、设备、订单、积分流水等查询建立索引。

这些措施能显著降低 Function 调用与 D1 读取次数。若流量继续增长，正确做法是升级 **Workers Paid**（以及按需的 D1 付费额度），而不是拆分多个 Cloudflare 账号。

## 关于「多 CF 号部署分摊额度」

本项目**不包含、也不建议**通过多个 Cloudflare 账号部署同一站点来绕过免费额度。此类做法属于规避平台用量限制，违反 Cloudflare 服务条款，可能导致账号或站点被限制/封禁，也会带来会话、数据分片与运维一致性问题。合规方案：

1. 升级 Workers Paid，获得更高请求与 CPU 配额；
2. 使用本项目已有的聚合接口、30 秒缓存与边缘静态资源；
3. 按业务拆分独立服务，而不是复制站点刷额度；
4. 结合 Cloudflare 缓存规则、D1 索引与分页，减少无效读取。

## 目录

```text
inu-cloud/
├─ worker/
│  ├─ index.js          # Hono API、鉴权、业务逻辑
│  └─ data.js           # 会员等级、商品、通知类型等静态数据
├─ migrations/
│  ├─ 0001_schema.sql       # D1 表结构与索引
│  ├─ 0002_seed.sql         # 演示账号与演示数据
│  ├─ 0003_oauth.sql        # GitHub / Google 登录绑定表
│  ├─ 0004_admin_oauth.sql  # 管理台、OAuth 应用、授权码/令牌/同意记录
│  ├─ 0005_features.sql     # 钱包/充值/提现/验证码/协议模板/站内信/商品与订单字段
│  └─ 0006_password_reset.sql # 密码找回申请
├─ src/
│  ├─ views/                # 业务页面 + 登录 / 管理台 / 授权同意页
│  │  └─ admin/             # 管理台九个分区组件，按需懒加载
│  ├─ components/           # AppShell、TopBar、SideBar、Modal、Toast 等
│  ├─ lib/                  # API 客户端、session、adminSections、adminHelpers、格式化、主题、toast
│  ├─ assets/base.css       # 设计系统与页面样式
│  ├─ assets/admin.css      # 管理台共享样式
│  ├─ router.js
│  └─ main.js
├─ public/
│  └─ inu-oauth-integration.md  # 可交给 AI 执行的 OAuth 接入指南模板
├─ CHANGELOG.md             # 版本更新日志
├─ .dev.vars.example        # 本地环境变量模板
├─ wrangler.jsonc
└─ vite.config.js
```

## 设计系统

- 背景 `#FAFAFF`，主色 `#5B97FF`，强调面 `#EEF2FF` / 深靛 `#1E1B4B`
- 文字 `#14121F` / `#6F6B82` / `#AAA5BF`
- 状态色 `#10B981` / `#F59E0B` / `#EF4444`
- 64px 顶栏、244px 侧栏、控件与卡片 12px 圆角，内层 8px
- 默认跟随系统明暗主题，手动切换后记住选择；桌面/平板/手机响应式布局

## 更新日志

版本变更、功能新增与修复记录见 [CHANGELOG.md](./CHANGELOG.md)。
