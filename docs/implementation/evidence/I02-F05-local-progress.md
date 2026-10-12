# I02-F05 Windows 本地进展

日期：2026-10-12

环境：Microsoft Windows NT 10.0.26300.0、PowerShell、Node.js 22.19.0、pnpm 11.1.3、Rust 1.95.0、Cargo 1.95.0。

## 已实现与本地验证

- 前端账号控件提供登录入口、服务端会话状态和退出操作；`pnpm check` 通过，17 个测试文件、79 项测试及生产构建通过。
- 后端 OIDC 授权码流程使用 PKCE；state、nonce 和 verifier 保存在服务端 Session。回调固定配置的 redirect URI，验证 state、ID token 签名/issuer/audience/nonce，并在 token 提供 `at_hash` 时核验 access token hash。
- Session Cookie 设置 HttpOnly、SameSite=Lax、Secure 配置；生产 Secure Cookie 使用 `__Host-` 前缀。变更请求经精确 Origin 白名单校验。
- API Session 使用 SQLite 文件存储，启动时创建幂等表结构，并周期清理过期会话；保存只更新现存记录，避免并发撤销后重新创建会话。
- 私有 workspace 路由从服务端 SQLite Session 读取身份；Windows 测试覆盖匿名拒绝、登录态读取、退出撤销后旧 Cookie 被拒绝、state 匹配和 Origin 精确校验。
- `pnpm check:backend` 于 2026-10-12 在 Windows 重新通过：fmt、check、Clippy、16 项 Rust 测试和 rustdoc。SQLx SQLite 在 Windows 完成编译；测试覆盖内存数据库中的会话写入、读取和撤销、工作区与学习记录的跨设备持久化及 owner 隔离，并通过真实磁盘 SQLite 文件验证关闭连接池后重新打开仍能使用原 Cookie 恢复会话身份。
- 配置样例 `backend/.env.example` 使用 `DATABASE_URL=sqlite://auth-sessions.db`；本机 `backend/.env` 当前不存在。检查过程中未读取或输出本地 secret。
- `pnpm content:validate` 与 `git diff --check` 通过。

## 未完成验收

仓库没有真实 OIDC issuer/client 配置，本次没有执行身份提供方的成功回调、错误 nonce 或提供方拒绝回调的端到端流程。示例配置使用占位值。SQLite Session 存储已有内存数据库集成测试；尚未使用真实 provider 配置验证端到端登录回调。

本次开发和验证均在 Windows 完成；未进行 Linux、WSL、Docker 或 Linux 容器验证。SQLite 存储验收已通过，但 I02-F05 的 OIDC 回调验收仍受真实 issuer/client 配置缺失阻塞，不能标为 DONE。
