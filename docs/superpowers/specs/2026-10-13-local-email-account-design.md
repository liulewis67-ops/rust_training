# 本地邮箱账号系统设计

日期：2026-10-13  
状态：待用户审阅  
范围：Rust/Axum 后端、SQLite、React 前端；Windows 原生开发

## 1. 背景与目标

当前后端要求配置 OIDC issuer、client ID、client secret 和 redirect URL 才能启动。OIDC 回调把外部 subject 直接写入服务端 session 的 `user_id`。学习进度和工作区通过该 ID 隔离数据。前端只有一个跳转到 OIDC 的账号入口，没有本地注册、登录或找回密码流程。

本次建立自有邮箱密码账号系统，支持公开自助注册、邮箱验证、登录、退出和密码重置。账号使用服务端 SQLite 保存，身份通过现有 HttpOnly 服务端 session 传递。外部 OIDC 实现保留在代码中并与本地账号路径隔离；当前默认关闭，不要求 OIDC 配置，不展示 OIDC 登录入口。后续 OIDC 身份通过 issuer 与 subject 映射到内部账号。

## 2. 已确认的产品与架构决定

- 账号标识为邮箱和密码。
- 公开自助注册。
- 注册后必须验证邮箱才能登录；支持邮件密码重置。
- 使用现有 SQLite 和 tower-sessions 服务端会话。
- 新账号取得随机、稳定的内部 UUID；业务表继续使用现有 `owner_id` 字符串，不改其结构。
- OIDC 实现保留在独立代码和 `/api/v1/auth/oidc/*` 路径下，默认禁用；OIDC 配置缺失不影响服务启动。未来启用时按 issuer+subject 查找内部身份映射，不再把外部 subject 当内部账号 ID。
- 不自动合并或迁移既有 OIDC subject 对应的数据；相关业务记录保持原样。
- SMTP 是邮箱验证和重置邮件的交付依赖。必需 SMTP 配置缺失或无效时，服务以清晰错误退出。
- 注册后不自动登录；提示检查邮箱。验证成功后引导登录。重置密码成功后回登录页。

## 3. 用户流程

### 注册与验证

1. 用户在 `/register` 提交邮箱和密码。
2. 服务规范化邮箱、校验密码、创建未验证账号，并创建验证令牌。
   若邮箱已属于未验证账号，则按相同通用响应重发验证邮件；若邮箱已验证，则仍返回通用响应且不发送邮件。
3. 邮件中包含站点 `/verify-email?token=...` 链接；验证 token 只在前端 POST 时消费，避免邮件安全扫描器仅通过 GET 消耗令牌。
4. 注册界面显示统一的“请检查邮箱”提示，不自动登录。
5. 用户打开链接后，前端 POST token 到验证 API。成功时显示验证成功并引导 `/login`。

### 登录与退出

1. 用户在 `/login` 提交邮箱和密码。
2. 服务在统一的密码错误响应下校验凭据；密码正确但邮箱未验证时，返回稳定的 `email_verification_required` 错误，并提供重发验证邮件操作。
3. 登录成功时轮换 session ID，将内部 UUID 写入 session，并只返回 `user_id` 与已验证邮箱。
4. 现有 12 小时不活跃过期、HttpOnly、SameSite=Lax Cookie 和 Origin 校验继续生效；生产 Cookie 使用 Secure。
5. 退出删除当前服务端 session，并通过既有 session-change 事件同步前端状态。

### 忘记与重置密码

1. 用户在 `/forgot-password` 提交邮箱。
2. 服务无论账号是否存在都返回相同成功提示，避免通过响应枚举账号。若账号存在且已验证，则发送重置邮件。
3. 用户打开 `/reset-password?token=...` 后提交 token 和新密码；令牌由 POST 消费。
4. 重置成功后在同一数据库事务中更新密码并删除 `auth_sessions.user_id` 匹配的全部会话，然后引导回登录页。已消费或过期令牌不能再次使用。

## 4. HTTP API 契约

所有 JSON 字段使用 `snake_case`，错误遵循项目的统一错误格式。密码和 token 仅经 HTTPS 请求体传输，不进入响应或日志。

| 方法与路径 | 用途 | 成功响应 |
|---|---|---|
| `POST /api/v1/auth/register` | 创建公开账号并发送验证邮件 | `202 Accepted`，通用“检查邮箱”结果 |
| `POST /api/v1/auth/verify-email` | 消费邮箱验证 token | `204 No Content` |
| `POST /api/v1/auth/resend-verification` | 重发验证邮件 | `202 Accepted`，通用结果 |
| `POST /api/v1/auth/login` | 邮箱密码登录并建立 session | `200 OK`，`{ user_id, email }` |
| `GET /api/v1/auth/session` | 查询当前 session | `200 OK`，`{ user_id, email }`；匿名为 `401` |
| `POST /api/v1/auth/logout` | 删除当前 session | `204 No Content` |
| `POST /api/v1/auth/forgot-password` | 请求密码重置邮件 | `202 Accepted`，无论邮箱是否存在均相同 |
| `POST /api/v1/auth/reset-password` | 消费重置 token 并设置新密码 | `204 No Content` |
| `/api/v1/auth/oidc/*` | 预留保留的 OIDC 登录与回调 | 当前未启用时不可发起外部跳转 |

写请求继续由全局 Origin 校验保护。未验证账号不能登录；无效邮箱/密码组合使用通用凭据错误。响应不返回密码哈希、token、内部 session ID 或账号存在性信息。

## 5. 数据模型与迁移

增加只追加的 SQLite 迁移；不得改写已应用迁移。

### `accounts`

- `id TEXT PRIMARY KEY`：随机 UUID，作为内部稳定用户 ID。
- `email_normalized TEXT NOT NULL UNIQUE`：去除首尾空白并按邮箱大小写不敏感规则规范化后的地址；保留独立展示值或按需从规范化值展示。
- `password_hash TEXT NOT NULL`：Argon2id 编码后的密码哈希。
- `email_verified_at INTEGER NULL`：UTC Unix 时间；空值表示尚未验证。
- `password_changed_at INTEGER NOT NULL`：UTC Unix 时间，可用于会话凭据版本或撤销判断。
- `created_at INTEGER NOT NULL`、`updated_at INTEGER NOT NULL`。

数据库唯一约束负责并发注册下的邮箱去重。账号 ID 不由邮箱派生，邮箱变更能力不在本次范围内。

### `account_action_tokens`

- `token_hash TEXT PRIMARY KEY`：高熵随机 bearer token 的 SHA-256 摘要，原 token 仅发给邮件，不落库。
- `account_id TEXT NOT NULL`，外键指向 `accounts.id`。
- `purpose TEXT NOT NULL`：仅允许 `verify_email` 或 `reset_password`。
- `expires_at INTEGER NOT NULL`、`consumed_at INTEGER NULL`、`created_at INTEGER NOT NULL`。
- 索引覆盖账号与用途，用于新令牌替换、消费和过期清理。

验证 token 有效期 24 小时；密码重置 token 有效期 30 分钟。两者均只能成功消费一次。生成新同用途 token 时，旧的未消费 token 失效。token 比较和消费在事务中进行，防止并发重复使用。

### `auth_sessions`

添加 nullable `user_id` 列及索引。session store 在创建/保存 session 时，从序列化 session 数据同步提取 `user_id`；匿名会话为 NULL。登录仍轮换 session ID。重置密码在事务中撤销该 `user_id` 对应的所有 session 行。过期清理同时清理 token；会话删除继续由现有 session store 执行。

现有 `workspaces`、`learning_*` 表及其 owner ID 不改写。SQLite 是本地账号和会话的持久数据源。

## 6. 密码、安全与滥用控制

- 使用经维护的 Argon2id crate 进行密码哈希，参数采用库维护者推荐的安全配置并在部署文档中固定；不自创密码学算法。
- 密码接受长口令，长度限定为 12 至 128 个 Unicode 字符；不要求大小写、数字和符号组合。按字节上限再设防止超大请求的硬限制。
- 邮箱验证和重置 token 至少包含 256 bit CSPRNG 熵；只存 SHA-256 摘要。日志不得写入 token、密码、邮件正文或 SMTP 密码。
- 登录错误不区分邮箱不存在与密码错误。注册、重发验证和忘记密码均使用不泄漏账号状态的响应。
- 对登录、注册、重发验证、忘记密码和 token 消费实施按 IP 与规范化邮箱的限流；返回 `429` 和明确的重试行为。限流状态需适用于本机 SQLite 服务的并发请求，并在实现计划中确定可测试的时间窗口与上限。
- 只信任直接连接的客户端地址；除非已配置明确的受信代理列表，不接受任意 `X-Forwarded-For` 作为限流 IP。
- 邮件链接使用配置的 `APP_ORIGIN` 拼接，不信任请求 Host。SMTP 传输要求 TLS；生产环境凭据仅从环境配置读取，不能提交真实密钥。
- CSRF Origin 防护覆盖所有新增 POST；密码哈希与邮件在事务外执行/发送，避免持有数据库写锁等待网络。

## 7. SMTP 与运行配置

新增必需配置：`SMTP_HOST`、`SMTP_PORT`、`SMTP_USERNAME`、`SMTP_PASSWORD`、`SMTP_FROM`、`SMTP_TLS`。`SMTP_TLS` 仅允许明确支持的安全模式，不提供无加密生产发送。所有字段在启动时校验，错误说明变量名但绝不回显密码。`APP_ORIGIN` 和 `DATABASE_URL` 沿用现有配置。

邮件发件人使用配置的显示名称与地址。邮件仅包含目的链接、过期说明和忽略非本人请求的提示。测试可用本机 fake SMTP 或可注入的邮件发送适配器，不依赖真实账户或外部 OIDC 服务。

更新 `.env.example`、运行说明和 Windows PowerShell 示例；真实 `backend/.env` 受忽略规则保护，不能读取、提交或在文档中复制其中的值。

## 8. 前端页面与账号入口

增加 SPA 路由与表单页面：

- `/login`：邮箱、密码、登录错误、忘记密码入口、注册入口。
- `/register`：邮箱和密码，成功后显示检查邮箱的通用提示。
- `/verify-email`：从 query 读取 token，提交后展示成功、失效或重新申请验证邮件的操作。
- `/forgot-password`：邮箱输入和统一提示。
- `/reset-password`：新密码输入，提交 token 后回登录。

顶栏 `AccountControl` 匿名时进入 `/login`；登录态显示邮箱并提供退出。所有页面处理加载、网络失败、字段校验和服务端错误。密码输入使用浏览器密码管理器可识别的 autocomplete 值。页面不存储密码或长期 token；token 仅短暂存在 URL 与 POST 流程中，成功后移除 query，避免留在后续导航中。验证与重置页面设置 `Referrer-Policy: no-referrer`，不加载第三方资源，减少 token 通过 Referer 泄漏的风险。OIDC 当前不显示按钮。

## 9. 范围外

- 当前不连接或启用外部 OIDC 身份提供商；不删除现有 OIDC 代码。
- 暂不实现 OIDC 账号链接、既有 OIDC 数据自动迁移或邮箱变更。
- 不新增第三方邮件服务 SDK 或新的数据库类型；先使用 SQLite 与 SMTP。
- 不实现社交登录、MFA、管理员后台、邀请制或账号删除。

## 10. 交付与验收条件

- 删除 OIDC 环境变量后，本地账号 API 服务可以启动；缺少 SMTP 必需配置时以脱敏错误拒绝启动。
- 注册、验证、未验证登录拒绝、已验证登录、session 查询、退出、忘记密码通用响应、重置密码和重放 token 拒绝均覆盖成功与失败路径。
- 密码重置后，账号此前的全部服务端 session 均失效；其他账号 session 不受影响。
- 唯一邮箱约束和 token 单次消费在并发请求下成立；密码与 token 不出现在日志和 API 响应中。
- 现有学习与工作区 API 继续使用 session 内稳定 UUID 进行 owner 隔离；匿名访问仍拒绝。
- OIDC 代码保持独立、默认不可用，且无 OIDC 配置时不阻断本地登录。
- 前端覆盖所有确认的页面流程，顶部账号入口与 session-change 同步正常。
- Windows 原生环境开发与验证；不执行 Linux 环境验证。
- 完成后更新 `docs/implementation-plan.md` 对应任务和 `docs/implementation/evidence/` 验收证据，注明只在 Windows 验证。

## 11. 待实施阶段确定的细节

实施计划需明确采用的 Rust/SMTP/Argon2id crate 及其经验证版本组合、SMTP TLS 模式校验规则、具体限流窗口与上限、迁移编号、API OpenAPI 契约文件位置、邮件模板、限流存储和会话列同步实现。此设计不包含生产 SMTP 凭据。
