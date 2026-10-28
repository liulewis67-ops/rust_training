# M09-L06：独立检查——为 CLI 与 API 呈现资料历史错误

> **综合自测：** 一个领域错误需要同时服务 CLI 和 HTTP API，如何既保持稳定错误码，又阻止内部信息泄漏？

## 学习目标与先修

完成 M09-L01–L05，能把领域错误稳定映射到 CLI/HTTP 契约，保留可重试信息，并区分公开错误消息与受控诊断。这份自测仍是**预发布草稿**，需要后续补齐可运行的公共验收工程。

## 检查说明

根据下面的公开契约自行建立本地 Rust 测试项目，对 CLI 与 HTTP API 分别实现错误呈现，并提交简短设计说明。当前未发布统一的起始工程，不要假设有可执行的隐藏测试或线上评分。

## 场景

一个工具既提供 `history-report` 命令，也提供 `GET /profiles/{id}/history?retention_days=...`。领域层已将故障分类为：保留天数无效、profile 不存在、历史存储暂时不可用。存储错误可能携带 SQL、数据库地址或凭据；这些内部细节只能进入受控诊断，不能进入终端消息或 API 响应。

## 固定呈现契约

| 失败类别 | CLI `stderr` | CLI 退出码 | API 状态码 | API `code` | API `message` | `retryable` |
|---|---|---:|---:|---|---|---|
| 保留天数无效 | `error: retention-days must be an integer from 1 to 365\n` | 2 | 400 | `invalid_retention_days` | `retention_days must be an integer from 1 to 365.` | false |
| profile 不存在 | `error: profile was not found\n` | 3 | 404 | `profile_not_found` | `profile was not found.` | false |
| 存储暂不可用 | `error: history service is temporarily unavailable; try again later\n` | 1 | 503 | `history_unavailable` | `history service is temporarily unavailable; retry later.` | true |

API 响应必须保留调用者传入的 `request_id`。所有 CLI 失败使用非零退出码。两种边界可针对同一故障给不同格式，但不得伪装成功、输出原始非法值、SQL、数据库地址或凭据。受控诊断访问器仍须保留存储失败的内部原因，使呈现层脱敏时没有销毁运维诊断。

## 先预测，再设计映射层

**先预测：** `retention_days=0` 应映射成什么 CLI 退出码和 HTTP 状态？存储暂不可用时客户端可以重试，但内部数据库连接地址是否应写在公开 `message` 中？

## 分阶段验收

1. 锁定 CLI 三种错误类别的 `stderr` 和退出码，不回显原始用户输入。
2. 锁定 HTTP 状态、`code`、`message` 与 `retryable` 的组合。
3. 确认 `request_id` 在错误映射后保持不变。
4. 注入包含 SQL/路径/凭据的模拟内部错误，断言它们不会出现在公开结果里。
5. 验证底层错误仍可供受控诊断追踪；不为了脱敏销毁所有来源信息。

**与 Java/Go 对比：** 可将它视为 Java 的业务异常到 ControllerAdvice 的映射，或 Go handler 的 error-to-HTTP 适配。核心域错误不应该直接依赖 HTTP 框架；Rust `Result` 的错误变体也应保持与传输协议解耦。

## 提交时附带说明

1. 为什么 CLI 退出码与 API 状态码/错误码不能互换？
2. 哪些信息给用户看，哪些信息只进入受控日志？如何关联 `request_id`？
3. 为什么暂时存储故障可以标为可重试，而输入错误和缺失 profile 不能？
4. 运行器或测试平台故障发生时，为什么不能把平台失败记为学习者能力失败？

## 自查清单

- [ ] 所有 CLI 错误均为非零退出码，公开文本逐字符合固定契约。
- [ ] HTTP 状态、错误码、重试标记和 request_id 逐项匹配。
- [ ] SQL、数据库主机名和凭据不出现在任何公开响应或 stderr。
- [ ] 受控诊断仍可以读取必要的底层失败原因。
- [ ] 所有结果有本地运行过的测试证据。

## 发布与环境说明

这是本地学习自测草稿，尚未提供正式起始 ZIP、托管评测、自动重试或技能档案。先以自己创建的无第三方依赖 Cargo 测试工程核查契约；未来提供经过 CI 验证的起始/参考工程后再考虑正式发布。

## 来源

- [Rust 标准库：Result](https://doc.rust-lang.org/std/result/)
- [Rust 标准库：Error](https://doc.rust-lang.org/std/error/trait.Error.html)

题面、错误映射与验收边界为原创。
