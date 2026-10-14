# I03-F01 Windows 本机实现与验证记录

- 日期：2026-10-15
- 状态：本机验收证据；I03-F01 完成，I03 发布或运行隔离验收仍未完成。
- 环境：Windows PowerShell、Node.js v22.19.0、pnpm 11.1.3、rustc/cargo 1.85.0（由 backend `rust-toolchain.toml` 锁定）。
- 前置：I02-F01–F10 的认证 session 与 owner-scoped 工作区接口已交付；I02 整体仍受 I01 发布门槛阻塞。按 I03 分册提前执行记录，F01 不依赖运行容器。

## 已交付

- `POST /api/v1/runs` 只接受固定 `run` 操作、已保存的 workspace ID/revision、有限 stdin 和幂等键。服务端从已认证 owner 的 workspace revision 读取源码，并在同一 SQLite 事务中保存不可变源码快照、stdin、来源 revision、摘要和 `queued` 状态；请求不能指定 shell、环境变量或 owner。
- 同一 owner 和幂等键重复提交返回既有任务；相同键对应不同请求时返回冲突。工作区 revision 过期返回冲突，workspace 不存在或不属于当前 owner 时返回相同 404。源码与 stdin 各限制为 64 KiB，HTTP body 有总上限。
- `GET /api/v1/runs/{id}` 只返回当前 owner 的任务收据，不暴露源码/stdin 快照。
- 编辑器登录且云端工作区可用时显示运行面板；提交前先保存当前文本，再按保存后的 revision 创建任务，并 GET 查询确认任务状态。面板允许填写标准输入，并明确当前任务只是排队，等待后续隔离运行节点接入。

## 验证

- `cargo test --locked`（`backend/`）：通过，39 项测试通过；新增测试覆盖快照不可变、并发重复幂等、key 冲突、未登录、跨 owner workspace/task、过期 revision、非法操作与 shell 字段、超长 stdin/source。
- `cargo fmt --all -- --check`、`cargo check --workspace --all-targets --locked`、`cargo doc --workspace --no-deps --locked`：通过。
- `pnpm check:backend`：通过，包含 Rust fmt、check、严格 Clippy、39 项 workspace 测试和 Rust 文档构建。为清除此入口原有的 `format_collect` 告警，限流键哈希改用 `LowerHex` 一次格式化，输出保持同一 SHA-256 小写十六进制值；限流行为测试通过。
- `pnpm check:frontend`：通过；Prettier、ESLint、TypeScript、24 个测试文件中的 128 项测试和 Vite 生产构建均通过。
- `pnpm exec vitest run src/features/execution src/features/workspace/DraftEditor.test.tsx`：通过，11 项定向测试通过，覆盖请求、任务响应校验、登录禁用、保存新 revision 后提交和 GET 查询。
- 本地没有启动容器，也没有运行 `pnpm r1:image`、`pnpm r1:run` 或其他 Docker/Linux 容器命令。

## 边界

- `queued` 状态由后续 I03-F02 的隔离 worker 消费；本任务不声称代码已编译或运行。
- I02 整体验收、I03 发布和 I01-F06 Linux 隔离验收状态均不变。
