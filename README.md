# INU 星际通行证

Vue 3 + Cloudflare Workers + D1 实现的「INU 无限宇宙」账号中心。包含 8 个账号业务页面、登录鉴权、真实的 D1 数据读写、会员/协议/补给站业务流程，以及一套可直接部署到 Cloudflare 的工程结构。

演示账号：`xiaoyiyi@inu.space` / `inu2026`

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | Vue 3 `<script setup>`、Vue Router 4、Vite 8 |
| 后端 | Hono 4（Cloudflare Workers） |
| 数据库 | Cloudflare D1（SQLite） |
| 部署 | Workers Static Assets + Wrangler 4 |
| 鉴权 | HttpOnly Cookie Session + PBKDF2-SHA256 + D1 会话表 |

## 功能

- **总览**：星能钱包、INU 粒子、会员进度、快捷入口、最近动态。
- **个人资料**：昵称/邮箱/签名修改、星际 ID 复制、星际公民认证（演示）。
- **账户安全**：安全评分、两步验证开关、登录保护策略、密码修改、安全日志。
- **星际终端**：设备列表、设备详情、解绑、退出其余终端、登录记录。
- **通知偏好**：通知类型、渠道开关、免打扰时段、每周摘要。
- **会员中心**：等级进度、四档会员权益、粒子流水。
- **协议中心**：协议列表、待签署提醒、签署后发放 50 INU 粒子。
- **补给站**：会员价商品、星能兑换下单、订单记录、收货坐标。

> 演示环境中的「星际公民认证」为模拟核验，会直接解锁补给站下单能力；生产环境请接入真实的实名/活体核验服务。

## 本地运行

```bash
npm install

# 初始化本地 D1（建表 + 演示数据）
npm run db:local

# 构建前端，再由 Worker 同时托管静态资源与 /api
npm run build
npm run worker:dev
# http://127.0.0.1:8787
```

前后端分离调试（可选）：

```bash
npm run worker:dev   # 终端 A，API 在 8787
npm run dev          # 终端 B，Vite 在 5173，/api 已代理到 8787
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
   npm run db:remote
   ```

4. 构建并部署：

   ```bash
   npm run deploy
   ```

5. 打开 `https://inu-space-pass.<你的子域>.workers.dev`。如需自定义域名，在
   Cloudflare 控制台 → Workers & Pages → `inu-space-pass` → Settings → Domains & Routes 绑定。

### 上线前必做

- 修改演示账号密码，或替换 `migrations/0002_seed.sql` 中的账号数据。
- 如面向公网，考虑关闭演示认证接口 `/api/profile/verify`，接入真实实名服务。
- 在 Workers Paid 方案下，将 `worker/index.js` 的 `PBKDF2_ITERATIONS` 提高到
  `100000` 以上（哈希串内已记录迭代次数，调整后旧密码仍可验证，用户下次改密时自动升级）。
- 为生产邮箱/短信/支付接入真实服务；当前相关按钮为演示提示。

## 第三方登录（GitHub / Google）

登录页支持 GitHub（主）与 Google（备用）OAuth。未配置的提供方会自动隐藏，邮箱密码登录不受影响。

### 1. 创建 OAuth 应用

GitHub：Settings → Developer settings → OAuth Apps → New OAuth App

- Homepage URL：`https://inu-space-pass.<你的子域>.workers.dev`
- Authorization callback URL：`https://inu-space-pass.<你的子域>.workers.dev/api/auth/oauth/github/callback`

Google：Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → Web application

- Authorized redirect URI：`https://inu-space-pass.<你的子域>.workers.dev/api/auth/oauth/google/callback`

本地调试时把域名换成 `http://127.0.0.1:8787`，并在 GitHub / Google 各加一条本地回调。

### 2. 配置密钥

```bash
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

本地写入 `.dev.vars`（已在 `.gitignore` 中，可参考 `.dev.vars.example`）：

```dotenv
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

设置后刷新登录页即可看到按钮；`GET /api/auth/providers` 会返回各提供方的启用状态。

### 3. 行为说明

- 只接受提供方返回的**已验证邮箱**；没有验证邮箱会拒绝登录。
- 邮箱已存在时自动绑定到该用户，不重复建号；否则创建新用户（无可用密码，只能走第三方登录）。
- `state` 存在 HttpOnly Cookie 中；Google 额外使用 PKCE（S256）。回调校验失败会回到登录页提示。
- 绑定关系存于 `oauth_accounts`（`migrations/0003_oauth.sql`），同一 `provider + subject` 唯一。

## API

所有 `/api/*` 响应均为 `private, no-store`，需要登录态。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/login` | 邮箱密码登录，失败 5 次锁定 15 分钟 |
| POST | `/api/auth/logout` | 退出并清除会话 |
| GET | `/api/auth/providers` | 第三方登录提供方启用状态（公开） |
| GET | `/api/auth/oauth/:provider/start` | 发起 OAuth 授权（公开，302 到提供方） |
| GET | `/api/auth/oauth/:provider/callback` | OAuth 回调，登录/建号后 302 回应用（公开） |
| GET | `/api/me` | 当前用户 |
| GET | `/api/overview` | 总览聚合数据 |
| GET / PATCH | `/api/profile` | 读取 / 更新资料 |
| POST | `/api/profile/verify` | 星际公民认证（演示） |
| GET | `/api/security` | 安全评分、凭证、策略、日志 |
| POST | `/api/security/2fa` | 两步验证开关 |
| PATCH | `/api/security/guards` | 登录保护开关 |
| POST | `/api/security/password` | 修改密码并吊销其它会话 |
| GET | `/api/devices` | 终端与登录记录 |
| POST | `/api/devices/:id/unbind` | 解绑终端 |
| POST | `/api/devices/logout-others` | 退出其余会话 |
| GET | `/api/notifications` | 通知偏好聚合 |
| PATCH | `/api/notifications/prefs` | 更新通知类型/渠道 |
| PATCH | `/api/notifications/settings` | 免打扰与摘要 |
| GET | `/api/member` | 会员等级、权益、粒子流水 |
| GET | `/api/agreements` | 协议列表 |
| POST | `/api/agreements/:id/sign` | 签署协议 +50 粒子 |
| GET | `/api/supply` | 补给站聚合数据 |
| POST | `/api/supply/orders` | 星能兑换下单 |
| PATCH | `/api/supply/address` | 保存收货坐标 |

## 请求次数优化

页面数据按「一页一接口」聚合：打开一个页面只产生 1 次 `/api` 请求。前端 `src/lib/api.js` 还有：

- GET 结果内存缓存 30 秒；
- 并发相同请求自动合并（in-flight dedupe）；
- 任意写操作后清空缓存，保证数据一致；
- 通过 `run_worker_first: ["/api/*"]` 让静态资源留在边缘，不消耗 Worker 调用；
- D1 为会话、日志、设备、订单、粒子流水等查询建立索引。

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
│  ├─ 0001_schema.sql   # D1 表结构与索引
│  ├─ 0002_seed.sql     # 演示账号与演示数据
│  └─ 0003_oauth.sql    # 第三方登录绑定表
├─ src/
│  ├─ views/            # 8 个业务页面 + 登录页
│  ├─ components/       # AppShell、TopBar、SideBar、Modal、Toast 等
│  ├─ lib/              # API 客户端、session、格式化、主题、toast
│  ├─ assets/base.css   # 设计系统与页面样式
│  ├─ router.js
│  └─ main.js
├─ wrangler.jsonc
└─ vite.config.js
```

## 设计系统

- 背景 `#F4F7FB`，主色 `#165DFF`，辅助色 `#8B5CF6` / `#06B6D4`
- 文字 `#1D2129` / `#4E5969` / `#86909C`
- 状态色 `#00B42A` / `#FF7D00` / `#F53F3F`
- 64px 顶栏、244px 侧栏、16px 卡片圆角
- 支持明暗主题、桌面/平板/手机响应式布局
