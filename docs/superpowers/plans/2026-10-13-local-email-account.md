# 本地邮箱账号系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` task by task. Work in the current Windows workspace and do not perform Linux validation.

**Goal:** 为 Rust Path 实现公开邮箱密码注册、邮箱验证、登录/退出、密码重置邮件闭环，并保留默认关闭的 OIDC 实现。

**Architecture:** 新建 accounts 后端模块与 SQLite 账号、一次性令牌和限流表；tower-sessions 将内部 UUID 同步到服务端 session 存储，以便密码重置原子撤销会话。identity.rs 保留 OIDC 协议实现，但 OIDC 不再是启动依赖；React 增加本地账号页面并替换顶栏入口。

**Tech Stack:** Rust 1.85 / Axum 0.8.9 / SQLx 0.8.6 / SQLite / tower-sessions 0.15.0；argon2 0.5.3、lettre 0.11.23、uuid 1.18.1、sha2 0.10.9、rand_core 0.6.4；React 18、TypeScript、Vite 6、Vitest。SMTP 使用 Lettre Tokio async transport 与 rustls，只允许 SMTPS 或强制 STARTTLS。

**Spec:** [本地邮箱账号设计](../specs/2026-10-13-local-email-account-design.md)

## 全局约束

- 在当前工作区单人开发；使用 Windows PowerShell、Windows Rust 工具链、Node 与 pnpm。
- 不执行 Linux、WSL、容器或 Linux CI 验证。
- 所有新增或修改 Rust 函数都带紧邻中文文档注释，测试函数也有中文注释。
- 密码、token、SMTP 密码、邮件正文和真实 backend/.env 不写入日志、响应、命令输出或 Git。
- SQLite migration 只追加，不修改既有 migration 或 owner 数据。
- 所有认证变更请求通过现有 Origin 防护；cookie 保持 HttpOnly、Secure（生产）、SameSite=Lax 和 12 小时不活跃过期。
- 登录未知邮箱与错误密码返回相同错误；注册、重发验证和找回密码不泄漏账号存在性。
- OIDC 代码保留；默认不开启、不要求 OIDC 配置启动、不显示 OIDC 入口。
- 密码用 Argon2id；一次性 token 至少 256 bit CSPRNG 熵且数据库只存 SHA-256 摘要。
- SMTP 行为由本机 fake SMTP 验证，不要求生产邮件凭据。

## 文件地图

| 文件                                                       | 职责                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| backend/Cargo.toml                                         | 固定 Argon2id、SMTP、UUID、SHA-256 和 CSPRNG 依赖。                |
| backend/migrations/0006_local_accounts.sql                 | 账号、令牌、限流表；auth_sessions.user_id 和索引。                 |
| backend/src/accounts/mod.rs                                | 本地账号 router、状态、DTO、request ID 错误 envelope 和 handler。  |
| backend/src/accounts/store.rs                              | SQLite 版本化迁移、账号/token CRUD、原子消费、会话撤销和限流存储。 |
| backend/src/accounts/security.rs                           | 邮箱/密码校验、Argon2id、token 生成与摘要。                        |
| backend/src/accounts/mailer.rs                             | SMTP 配置、邮件模板和可替换 async 邮件发送接口。                   |
| backend/src/accounts/rate_limit.rs                         | 固定窗口限流规则与 key 派生。                                      |
| backend/src/accounts/tests.rs                              | 内存 SQLite、FakeMailer 和 API 集成测试辅助。                      |
| backend/src/sessions.rs                                    | 将 Record 中的 user_id 同步至 auth_sessions.user_id。              |
| backend/src/main.rs                                        | 本地账号/SMTP 配置、router 合并，OIDC 可选挂载。                   |
| backend/src/identity.rs                                    | 保留 OIDC state/nonce/PKCE/callback 实现及专属测试。               |
| backend/.env.example                                       | 本地 SQLite、APP_ORIGIN、SMTP 和 COOKIE 样例，无真实密钥。         |
| backend/src/accounts/openapi.yaml                          | 后端内的账号端点契约。                                             |
| src/features/identity/api.ts                               | session、注册、验证、登录、退出、重发、找回和重置 API client。     |
| src/features/identity/AuthPage.tsx                         | 登录/注册/验证/找回/重置五种认证视图。                             |
| src/features/identity/AuthPage.css                         | 认证表单样式、窄屏布局和 focus 状态。                              |
| src/features/identity/AccountControl.tsx                   | 匿名进入站内登录；登录时显示邮箱并退出。                           |
| src/app/router.ts, src/app/App.tsx                         | 五个认证 SPA route 和页面切换。                                    |
| src/features/identity/AuthPage.test.tsx                    | 表单、成功/失败、token 提交与导航测试。                            |
| src/features/identity/AccountControl.test.tsx              | session 显示、退出与 auth-change 同步测试。                        |
| docs/contracts/auth.openapi.yaml                           | 公共 API 契约。                                                    |
| docs/implementation/i02.md, docs/implementation-plan.md    | F05 范围、状态、计数及 OIDC 延期说明。                             |
| docs/implementation/evidence/I02-F05-local-auth-windows.md | 只在 Windows 完成的命令、结果和端到端证据。                        |

## 依赖版本依据

- [argon2 0.5.3](https://docs.rs/crate/argon2/0.5.3) 默认算法为 Argon2id，MSRV 1.65。
- [lettre 0.11.23 manifest](https://docs.rs/crate/lettre/0.11.23/source/Cargo.toml) 的 Rust 版本为 1.85；显式启用 builder、smtp-transport、tokio1、tokio1-rustls、ring 和 webpki-roots，不启用默认 native-TLS。SMTP TLS 使用其 [AsyncSmtpTransport 文档](https://docs.rs/lettre/0.11.23/lettre/transport/smtp/struct.AsyncSmtpTransport.html) 中强制 STARTTLS 或 SMTPS 模式。
- [uuid 1.18.1](https://docs.rs/crate/uuid/1.18.1/source/Cargo.toml) 的 MSRV 为 1.63，启用 v4。
- [sha2 0.10.9](https://docs.rs/crate/sha2/0.10.9) 与 Argon2 0.5 的 digest 0.10 依赖线匹配，MSRV 为 1.41。
- [rand_core 0.6.4](https://docs.rs/crate/rand_core/0.6.4) 与 password-hash 0.5 RNG traits 匹配，启用 getrandom。

---

### Task 1: 固定依赖并建立追加 migration

**Files:** Modify backend/Cargo.toml; create backend/migrations/0006_local_accounts.sql, backend/src/accounts/mod.rs and backend/src/accounts/tests.rs.

**Interfaces:** accounts::router(AccountState) -> Router；version 0006 建 accounts、account_action_tokens、auth_rate_limits 表，条件添加 auth_sessions.user_id 和索引。

- [x] **Step 1: 添加依赖。** 在 Cargo.toml 增加：

  argon2 = "=0.5.3"
  lettre = { version = "=0.11.23", default-features = false, features = ["builder", "smtp-transport", "tokio1", "tokio1-rustls", "ring", "webpki-roots"] }
  rand_core = { version = "=0.6.4", features = ["getrandom"] }
  sha2 = "=0.10.9"
  uuid = { version = "=1.18.1", features = ["v4"] }

Run: cargo check --manifest-path backend/Cargo.toml
Expected: PASS on the installed Windows toolchain; Cargo.lock contains these exact versions.

- [x] **Step 2: Write migration test.** Apply 0006 twice on sqlite::memory:; assert all new tables exist, auth_sessions accepts NULL user_id, duplicate accounts.email_normalized fails, an invalid token purpose fails its CHECK, and a second process start does not try ALTER TABLE again.

Run: cargo test --manifest-path backend/Cargo.toml accounts::tests::migration_is_additive_and_idempotent
Expected: FAIL before migration exists.

- [x] **Step 3: Implement versioned migration.** Create auth_schema_migrations. In AccountStore::migrate, begin a transaction, skip version 0006 when recorded, create new tables, inspect PRAGMA table_info(auth_sessions), run ALTER TABLE auth_sessions ADD COLUMN user_id TEXT only when absent, create indexes, record 0006 and commit. A failure rolls back the whole version. Do not edit 0001–0005.

- [x] **Step 4: Run migration test and format check.**

Run: cargo test --manifest-path backend/Cargo.toml accounts::tests::migration_is_additive_and_idempotent
Run: cargo fmt --manifest-path backend/Cargo.toml -- --check
Expected: both PASS.

### Task 2: Implement account store and email normalization

**Files:** Create backend/src/accounts/store.rs; modify accounts/mod.rs and accounts/tests.rs.

**Interfaces:** AccountStore::connect(database_url) runs migration; create_unverified(email,hash,now) returns UUID; find_by_email(email) returns optional AccountRecord; normalize_email(input) trims, checks a single address, rejects controls/overlength, lowercases ASCII for comparison, and preserves display form.

- [x] **Step 1: Write email tests.** Assert " Alice@Example.Test " normalizes to alice@example.test; reject blank, missing local/domain, CR/LF, and over 254 UTF-8 bytes.

Run: cargo test --manifest-path backend/Cargo.toml accounts::tests::normalizes_and_validates_email
Expected: FAIL before implementation.

- [x] **Step 2: Implement the typed normalized email.** Add NormalizedEmail { normalized, display }; do not log or return submitted values on validation failure.

- [x] **Step 3: Write store tests.** Insert/query an account in memory SQLite; duplicate normalized email must fail without exposing SQLite diagnostics.

Run: cargo test --manifest-path backend/Cargo.toml accounts::tests::account_store_enforces_unique_normalized_email

- [x] **Step 4: Implement AccountStore.** Bind all SQL values, generate UUID at the use-case boundary, and map persistence details to AccountStoreError::Unavailable or a domain conflict.

- [x] **Step 5: Run focused tests and formatting.**

Run: cargo test --manifest-path backend/Cargo.toml accounts::tests::account_store
Run: cargo fmt --manifest-path backend/Cargo.toml -- --check
Expected: PASS.

### Task 3: Implement password policy, Argon2id and action tokens

**Files:** Create backend/src/accounts/security.rs; modify accounts/mod.rs and accounts/tests.rs.

**Interfaces:** validate_password(password); hash_password(password) -> PHC string; verify_password(password,hash); new_action_token() -> plaintext token plus lowercase SHA-256 digest.

- [x] **Step 1: Write password boundary tests.** Reject 11 and 129 Unicode scalar values; accept 12, 128, spaces and Unicode; reject UTF-8 values over 512 bytes.

Run: cargo test --manifest-path backend/Cargo.toml accounts::tests::password_policy

- [x] **Step 2: Write password/token tests.** Two hashes for one password differ and start with $argon2id$; correct verify succeeds, wrong verify fails; tokens are distinct 64-character hex strings and differ from their stored digests.

Run: cargo test --manifest-path backend/Cargo.toml accounts::tests::hashes_password_and_issues_unpredictable_token

- [x] **Step 3: Implement cryptographic helpers.** Use Argon2id v0x13 with Params::new(19456, 2, 1, None); generate a 16-byte salt and 32-byte token with rand_core::OsRng; hash tokens with SHA-256 only.

- [x] **Step 4: Bound blocking hash work.** Execute Argon2 through spawn_blocking behind a semaphore; surface JoinError as a service error, never panic on request data.

- [x] **Step 5: Run security tests and record hash time.** Run cargo test --manifest-path backend/Cargo.toml accounts::tests::password\_. Record Windows hash latency; if it exceeds 1 second, lower max concurrency rather than weakening Argon2 parameters.

### Task 4: Implement SMTP configuration and fakeable mailer

**Files:** Create backend/src/accounts/mailer.rs; modify accounts/mod.rs and accounts/tests.rs.

**Interfaces:** SmtpConfig::from_map validates SMTP_HOST/PORT/USERNAME/PASSWORD/FROM/TLS; Mailer::send_action(ActionEmail) is async; FakeMailer sends messages over a Tokio channel for tests.

- [x] **Step 1: Write config tests.** Missing each required field, invalid port/TLS mode/FROM are errors; errors name the variable but never contain a password sentinel.

Run: cargo test --manifest-path backend/Cargo.toml accounts::tests::smtp_config

- [x] **Step 2: Implement SmtpConfig and TLS enum.** Support only starttls_required and implicit_tls; parse sender as lettre Mailbox; reject empty credentials and invalid values at startup.

- [x] **Step 3: Write FakeMailer test.** Capture generated verification/reset email and assert APP_ORIGIN URL, purpose path, expiration text and no SMTP credential in content.

- [x] **Step 4: Implement SmtpMailer.** Use AsyncSmtpTransport<Tokio1Executor>; starttls_relay for required STARTTLS and relay for implicit TLS; apply 10-second timeout and map errors to MailError::Unavailable without logging message/token.

- [x] **Step 5: Run focused tests.**

Run: cargo test --manifest-path backend/Cargo.toml accounts::tests::smtp\_
Expected: PASS without contacting a real SMTP host.

### Task 5: Implement durable rate limits

**Files:** Create backend/src/accounts/rate_limit.rs; modify store.rs, mod.rs and tests.rs.

**Interfaces:** RateLimitPolicy { max_hits, window_seconds }; consume_limit(key_hash,policy,now) -> RateLimitDecision. Login 10/15 min per IP+email and 10/15 min per normalized email; register 5/hour per IP; verify/resend/forgot/reset 10/hour per IP and 5/hour per token digest; email sends 3/hour per normalized email.

- [x] **Step 1: Write fixed-window tests.** First 10 requests allowed, 11th denied; exact next window allows requests; other keys remain independent; concurrent requests cannot exceed quota.

Run: cargo test --manifest-path backend/Cargo.toml accounts::tests::rate_limit

- [x] **Step 2: Implement atomic SQLite upsert.** Store one row per SHA-256 key digest; reset hit_count when expires_at <= now, otherwise increment; return exact retry_after_seconds.

- [x] **Step 3: Implement rate keys.** Hash normalized email and direct ConnectInfo peer IP; consume applicable email, IP, pair and token keys; ignore X-Forwarded-For because no trusted proxy list exists.

- [x] **Step 4: Run tests.** Run cargo test --manifest-path backend/Cargo.toml accounts::tests::rate_limit; expect concurrency and boundary assertions PASS.

### Task 6: Implement registration, verification and resend

**Files:** Modify accounts/store.rs, accounts/mod.rs and accounts/tests.rs.

**Interfaces:** POST /register accepts {email,password}, returns generic 202; POST /verify-email accepts {token}, returns 204; POST /resend-verification accepts {email}, returns generic 202. Email verification token lasts 24 hours, one use.

- [x] **Step 1: Write API tests.** New and existing email registrations return identical status/body; duplicate unverified sends a replacement email; duplicate verified sends none; invalid password is 400; missing Origin is 403.

Run: cargo test --manifest-path backend/Cargo.toml accounts::tests::register\_

- [x] **Step 2: Write token tests.** Successful token verifies once; replay, expired token and token for another account fail; two concurrent consumers yield at most one success.

Run: cargo test --manifest-path backend/Cargo.toml accounts::tests::verify\_

- [x] **Step 3: Implement create/replace transaction.** Hash password before transaction; insert account+token digest in a short transaction; new same-purpose token invalidates prior unused token. Send email after commit. If SMTP fails, preserve account/token for resend and still return the same generic 202 response, logging only a redacted failure category so email existence cannot be inferred.

- [x] **Step 4: Implement handler DTO/error envelope.** Deny unknown JSON fields; errors include stable code, display message, unique request_id, retryable and optional field_errors; no SQL, raw email, provider diagnostics or token in output. Generic credential errors compare on stable public fields rather than request_id.

- [x] **Step 5: Run registration and verification tests.** Run the register* and verify* test filters; expected all success, duplicate and token replay paths PASS.

### Task 7: Implement local login/session and make OIDC optional

**Files:** Modify backend/src/sessions.rs, accounts/store.rs, accounts/mod.rs, backend/src/main.rs, backend/src/identity.rs and accounts/tests.rs.

**Interfaces:** POST /login returns 200 {user_id,email}; unknown email and wrong password share 401 invalid_credentials; correct unverified account returns 403 email_verification_required. GET /session returns {user_id,email}; POST /logout returns 204. OIDC routes use /api/v1/auth/oidc/\* and are mounted only when OIDC_ENABLED=true.

- [x] **Step 1: Write session owner test.** After session insert(user_id), auth_sessions.user_id equals the ID; anonymous session stores NULL; delete removes row.

Run: cargo test --manifest-path backend/Cargo.toml sessions::tests::persists_account_owner

- [x] **Step 2: Implement session owner sync.** During create/save, serialize Record data and extract only top-level nonempty user_id; save data, expiry and user_id together. Preserve cycle_id and delete semantics.

- [x] **Step 3: Write local login API tests.** Check verified/unverified/invalid credentials, ID rotation, session response, logout, and unchanged learning/workspace owner isolation.

Run: cargo test --manifest-path backend/Cargo.toml accounts::tests::login\_

- [x] **Step 4: Implement login/session/logout.** Verify unknown-email dummy Argon2 hash to reduce timing differences; for a verified account, verify password, cycle session ID and save internal UUID/email. Logout deletes only current server session.

- [x] **Step 5: Make OIDC explicitly optional.** Parse OIDC_ENABLED=false by default. When false, skip discovery and omit OIDC routes. When true, require the full existing OIDC config and mount only the OIDC subrouter. Preserve the existing OIDC protocol implementation and update its route-specific tests.

- [x] **Step 6: Run Windows auth/session regression.**

Run: cargo test --manifest-path backend/Cargo.toml accounts::tests::login\_
Run: cargo test --manifest-path backend/Cargo.toml identity::tests
Run: cargo test --manifest-path backend/Cargo.toml sessions::tests
Expected: all pass without contacting an external issuer when OIDC_ENABLED is absent.

### Task 8: Implement forgot-password, reset and session revocation

**Files:** Modify accounts/store.rs, accounts/mod.rs and accounts/tests.rs.

**Interfaces:** POST /forgot-password always returns the same 202 body; only verified accounts receive email. POST /reset-password accepts {token,new_password}; token lasts 30 minutes and is one use.

- [x] **Step 1: Write account enumeration test.** Nonexistent, unverified and verified emails receive byte-identical status/body; only verified account causes mail send.

Run: cargo test --manifest-path backend/Cargo.toml accounts::tests::forgot*password*

- [x] **Step 2: Write reset/session test.** Create two sessions for target account and one for another; reset deletes only target rows; new password works, old password fails, token replay fails.

Run: cargo test --manifest-path backend/Cargo.toml accounts::tests::reset*password*

- [x] **Step 3: Implement forgot-password handler.** Enforce rate limit, generate/reset token only for a verified account, and return identical 202 for every email. If SMTP fails, still return the generic response and record only a redacted failure category.

- [x] **Step 4: Implement atomic reset transaction.** Hash outside transaction; conditionally consume an unexpired token, update password_hash/password_changed_at and delete auth_sessions by user_id in the same transaction. Roll back if exactly one token row was not consumed.

- [x] **Step 5: Add cleanup and run auth tests.** Periodic cleanup removes only expired action tokens and rate-limit rows. Run cargo test --manifest-path backend/Cargo.toml accounts::tests; all auth storage and API tests must pass.

### Task 9: Implement frontend API client and five auth views

**Files:** Create src/features/identity/api.ts, AuthPage.tsx, AuthPage.css and AuthPage.test.tsx.

**Interfaces:** AuthPage mode is login/register/verify/forgot/reset. API module exports login, register, verifyEmail, resendVerification, forgotPassword, resetPassword, readSession and logout; all requests use same-origin credentials.

- [x] **Step 1: Write form tests.** Login sends email/password and displays server error; blank fields do not send; register success displays generic inbox message without auto-login; links reach register/login/forgot pages.

Run: pnpm exec vitest run src/features/identity/AuthPage.test.tsx

- [x] **Step 2: Implement typed API functions.** Parse stable JSON error codes; non-JSON gateway response becomes generic network error; never log credentials. Session/logout dispatch rust-path-session-changed.

- [x] **Step 3: Implement login/register views.** Set username/current-password/new-password autocomplete; accessible labels, field error relationships, loading and retry states; validate 12–128 Unicode characters client-side while keeping server validation authoritative.

- [x] **Step 4: Write verify/reset URL tests.** Verify and reset modes POST query token; after response remove token via history.replaceState; forgot-password displays the same message for all emails.

- [x] **Step 5: Implement verify/resend/forgot/reset views.** Token is consumed only by POST, never GET. Reset success navigates to /login. Pages load no third-party resources.

- [x] **Step 6: Style and run the page tests.** Use existing CSS variables, visible focus ring, narrow-screen single column and prefers-reduced-motion. Run pnpm exec vitest run src/features/identity/AuthPage.test.tsx; expect PASS.

### Task 10: Wire SPA routes, AccountControl and no-referrer policy

**Files:** Modify src/app/router.ts, src/app/App.tsx, AccountControl.tsx/test, backend/src/main.rs and accounts/mod.rs.

**Interfaces:** readRoute recognizes /login, /register, /verify-email, /forgot-password, /reset-password. AccountControl uses session email. Auth page responses set Referrer-Policy: no-referrer.

- [x] **Step 1: Write routing and account-control tests.** Each path selects correct AuthPage mode; unknown path remains not-found; anonymous UI links to /login; signed-in UI displays email and logout refreshes status.

Run: pnpm exec vitest run src/features/identity/AccountControl.test.tsx src/app/router.test.ts

- [x] **Step 2: Wire SPA paths.** Map route to auth mode; direct refresh keeps correct page. Accept only same-site return paths; reject //host and scheme URLs.

- [x] **Step 3: Replace OIDC AccountControl link.** Call readSession/login/logout API; store userId/email; listen for rust-path-session-changed and refresh. Keep existing learning/draft listeners working.

- [x] **Step 4: Add no-referrer response header.** Add header for auth pages and test it through an Axum router response. Confirm GET token page never consumes action tokens.

- [x] **Step 5: Run UI regressions.**

Run: pnpm exec vitest run src/features/identity src/features/learning/cloudLearning.test.ts src/features/workspace/cloudDrafts.test.ts
Expected: auth, learning owner and workspace session-sync tests PASS.

### Task 11: Add OpenAPI, env examples, Windows instructions and stage records

**Files:** Create docs/contracts/auth.openapi.yaml and docs/implementation/evidence/I02-F05-local-auth-windows.md; modify backend/.env.example, docs/implementation/i02.md and docs/implementation-plan.md.

- [x] **Step 1: Write OpenAPI contract.** Describe all eight local endpoints, schemas, success/error status, stable error codes, session cookie, Origin requirements and 429 Retry-After; compare every path against accounts::router.

- [x] **Step 2: Update env example and local instructions.** Add SMTP_HOST/PORT/USERNAME/PASSWORD/FROM/TLS, OIDC_ENABLED=false, APP_ORIGIN and SQLite database URL using fake values. Do not inspect or stage backend/.env. Require STARTTLS in sample.

- [x] **Step 3: Re-scope I02-F05.** Rename its current deliverable to local email account and session. Record the user-approved scope change: OIDC provider hookup is deferred, protocol implementation and prior local tests remain. Set F05 DOING and leave acceptance unchecked until all tests and evidence exist.

- [x] **Step 4: Review scope coverage.** Run git diff --check; compare spec sections 1–10 against backend, migration, UI, OpenAPI, env and ledger. Fix mismatches before final verification.

### Task 12: Verify on Windows and mark F05 complete

**Files:** Modify docs/implementation/i02.md, docs/implementation-plan.md and docs/implementation/evidence/I02-F05-local-auth-windows.md; implementation files only for fixes.

- [x] **Step 1: Run Windows Rust checks.**

  cargo fmt --manifest-path backend/Cargo.toml -- --check
  cargo clippy --manifest-path backend/Cargo.toml --all-targets -- -D warnings
  cargo test --manifest-path backend/Cargo.toml

Expected: all exit code 0; do not run WSL, Docker/Linux, Linux target or Linux runner.

- [x] **Step 2: Run Windows frontend checks.**

  pnpm exec prettier --check src/features/identity src/app/router.ts src/app/App.tsx
  pnpm exec eslint src/features/identity src/app
  pnpm exec tsc -b --pretty
  pnpm exec vitest run src/features/identity src/features/learning/cloudLearning.test.ts src/features/workspace/cloudDrafts.test.ts
  pnpm build

Expected: all commands pass. If Prettier does not accept directory inputs, use exact changed file paths and record them.

- [x] **Step 3: Run fake mail adapter SQLite end-to-end.** On Windows use real Axum routes, an in-memory SQLite database and injected FakeMailer. Register; capture verification mail; verify; reject wrong password; login; read session; request reset; capture reset link; reset password; verify old cookie invalid and old password rejected/new password accepted; reject token replay. Verify duplicate registration, recovery after SMTP adapter failure, token expiry/one-use, concurrent rate limits and cookie ID rotation. SMTP transport configuration and TLS mode are unit-tested; a live external SMTP handshake is environment-dependent and not part of this run.

- [x] **Step 4: Record evidence and mark stage.** Record Windows build/OS versions, exact command lines/results, inputs, expected/actual outputs, fake mail adapter evidence and date. Only after every criterion passes mark F05 DONE and check its criteria. Update I02 count to 10/10 while keeping parent I02 DOING because I01 release prerequisite remains.

- [x] **Step 5: Review and commit one F05 stage.** Run git diff --check; inspect git status --short; verify backend/.env is neither staged nor tracked. Commit only local auth code/config/contracts/evidence and F05 ledger as feat(I02-F05): 本地邮箱账号系统. Then verify git status --short --branch is clean.

## Plan self-review

- Spec sections 1–2: Tasks 7 and 11 preserve OIDC implementation, make configuration optional, use internal UUID, and document no automatic owner migration.
- Spec sections 3–4: Tasks 6–10 cover each API, generic responses, one-time tokens, UI and OpenAPI.
- Spec section 5: Tasks 1–2, 6–8 cover additive migrations, internal IDs, hashed tokens, session owner and atomic revocation.
- Spec sections 6–7: Tasks 3–5, 8, 11–12 cover password policy, Argon2id, token entropy, limits, Origin, SMTP TLS, config and secret handling.
- Spec sections 8–10: Tasks 9–12 cover pages, AccountControl, no-referrer policy, Windows verification and ledger evidence.
- Spec section 11 is resolved with the dependency versions and limits above, API contract path docs/contracts/auth.openapi.yaml and local fake SMTP.
- The plan has no TBD/TODO placeholders; each interface is declared before use. All validation commands are Windows commands.

## Execution

用户已选择单人在当前工作区直接开发，因此按 Task 1–12 顺序在本线程执行；不创建 worktree、不派发子代理。所有最终验证均在 Windows 完成。
