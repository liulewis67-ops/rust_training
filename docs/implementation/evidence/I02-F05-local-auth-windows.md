# I02-F05 Windows 本地邮箱账号验收

- 日期：2026-10-14（Asia/Shanghai）
- 环境：Microsoft Windows 11 家庭版中文版，10.0.26300；`x86_64-pc-windows-msvc`
- Rust：`rustc 1.95.0 (59807616e 2026-04-14)`；Cargo `1.95.0`
- Node.js：`v22.19.0`；pnpm `11.1.3`
- 提交：本阶段提交 SHA 见本次验收答复；可在当前工作区运行 `git log -1 --format=%H` 定位。

## 自动化检查

所有命令均在 Windows PowerShell 原生环境运行，没有使用 WSL、Docker、Linux target 或 Linux runner。

| 命令 | 结果 |
| --- | --- |
| `cargo fmt --manifest-path backend/Cargo.toml -- --check` | 通过 |
| `cargo clippy --manifest-path backend/Cargo.toml --all-targets -- -D warnings` | 通过 |
| `cargo test --manifest-path backend/Cargo.toml` | 36 项通过，0 失败 |
| `cargo build --manifest-path backend/Cargo.toml --locked` | 通过，生成 Windows API 可执行文件 |
| `pnpm check` | 通过：Prettier、ESLint、TypeScript、22 个 Vitest 文件共 115 项测试及 Vite 生产构建 |

账号 API 测试使用 Axum 路由、SQLite 和注入的 FakeMailer，覆盖注册、邮箱验证、验证令牌替换/过期/并发单次消费、找回密码防枚举、重置令牌单次消费、SMTP 投递失败后的重发恢复、登录、密码更新、会话 ID 轮换、目标账号全会话撤销及其他账号会话保留。SMTP 配置与加密传输构造在测试中校验；没有向真实 SMTP 服务投递邮件。

## Windows 服务启动检查

在 `backend/target/debug` 临时目录启动 `rust-path-api.exe`，使用临时 SQLite 文件、`OIDC_ENABLED=false`、占位 SMTP 参数和本机 HTTP origin。进程环境没有 OIDC issuer/client 配置。检查结果：

| 请求 | 实际结果 | 预期 |
| --- | ---: | ---: |
| `GET /api/v1/auth/session` | 401，带 `Referrer-Policy: no-referrer` | 401 |
| `GET /api/v1/auth/oidc/login` | 404 | OIDC 默认不挂载 |
| 无 `Origin` 的 `POST /api/v1/auth/forgot-password` | 403 | 拒绝跨站变更请求 |

停止服务后删除了本次生成的临时 SQLite 文件。未查看或暂存 `backend/.env`；已确认它被 Git 忽略且未被跟踪。

## 范围说明

OIDC 协议实现保留在 `/api/v1/auth/oidc/*`，默认不启用；真实 OIDC provider 集成按用户决定延期。此阶段没有进行真实 SMTP 网络握手或邮件送达验收；其余认证邮件流程由 FakeMailer 集成测试覆盖。
