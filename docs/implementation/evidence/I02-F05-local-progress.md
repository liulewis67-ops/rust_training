# I02-F05 Windows 本地进展

日期：2026-10-12

环境：Windows、PowerShell、Node.js 22.19.0、pnpm 11.1.3、Rust 1.85.0、Cargo 1.85.0。

## 已实现与本地验证

- 前端账号控件提供登录入口、服务端会话状态和退出操作；`pnpm check` 通过，17 个测试文件、79 项测试及生产构建通过。
- 后端 OIDC 授权码流程使用 PKCE；state、nonce 和 verifier 保存在服务端 Session。回调固定配置的 redirect URI，验证 state、ID token 签名/issuer/audience/nonce，并在 token 提供 `at_hash` 时核验 access token hash。
- Session Cookie 设置 HttpOnly、SameSite=Lax、Secure 配置；生产 Secure Cookie 使用 `__Host-` 前缀。变更请求经精确 Origin 白名单校验。
- API Session 已改为 PostgreSQL 存储，加入启动迁移、过期清理和会话删除；保存采用只更新现有记录的语义，避免已撤销会话被并发写入重新创建。
- 私有 workspace 路由从服务端 Session 读取身份；Windows 测试覆盖匿名拒绝、已登录访问、state 匹配和 Origin 精确校验。
- `pnpm check:backend` 通过：fmt、check、Clippy、7 项 Rust 测试和 rustdoc。PostgreSQL store 已通过 Windows Rust 编译和 Clippy；Origin Cookie 配置验证也有覆盖。
- `pnpm content:validate` 与 `git diff --check` 通过。

## 未完成验收

仓库没有真实 OIDC issuer/client 配置，本次没有执行真实提供方的成功回调、错误 nonce 或提供方拒绝回调的端到端流程。示例配置使用占位值。当前 Windows 环境的 PostgreSQL 5432 端口没有监听，因此没有运行迁移或 Session Store 的数据库集成验收；部署时需配置 `DATABASE_URL` 并验证 PostgreSQL 连接。

本次开发和验证均在 Windows 完成；未进行 Linux、WSL、Docker 或 Linux 容器验证。因此 I02-F05 保持 DOING，不能据此视为完整验收。
