# M09-L06：独立检查——为 CLI 与 API 呈现资料历史错误

## 检查说明

请只阅读本题和起始工作区，不查看 M09 的教师参考或隐藏测试。这个场景和字段是新变式。按给出的类型和函数签名实现 CLI 与 HTTP API 的错误呈现，通过公开契约检查，并提交一段简短设计说明。不要更改错误枚举、公开结构体或函数签名，也不要添加依赖。

## 场景

一个工具既提供 `history-report` 命令，也提供 `GET /profiles/{id}/history?retention_days=...`。领域层已将故障分类为：保留天数无效、profile 不存在、历史存储暂时不可用。存储错误可能携带 SQL、数据库地址或凭据；这些内部细节只能进入受控诊断，不能进入终端消息或 API 响应。

## 固定呈现契约

| 失败类别 | CLI `stderr` | CLI 退出码 | API 状态码 | API `code` | API `message` | `retryable` |
|---|---|---:|---:|---|---|---|
| 保留天数无效 | `error: retention-days must be an integer from 1 to 365\n` | 2 | 400 | `invalid_retention_days` | `retention_days must be an integer from 1 to 365.` | false |
| profile 不存在 | `error: profile was not found\n` | 3 | 404 | `profile_not_found` | `profile was not found.` | false |
| 存储暂不可用 | `error: history service is temporarily unavailable; try again later\n` | 1 | 503 | `history_unavailable` | `history service is temporarily unavailable; retry later.` | true |

API 响应必须保留调用者传入的 `request_id`。所有 CLI 失败使用非零退出码。两种边界可针对同一故障给不同格式，但不得伪装成功、输出原始非法值、SQL、数据库地址或凭据。受控诊断访问器仍须保留存储失败的内部原因，使呈现层脱敏时没有销毁运维诊断。

## 提交时附带说明

1. 为什么 CLI 退出码与 API 状态码/错误码不能互换？
2. 哪些信息给用户看，哪些信息只进入受控日志？如何关联 `request_id`？
3. 为什么暂时存储故障可以标为可重试，而输入错误和缺失 profile 不能？
4. 运行器或测试平台故障发生时，为什么不能把平台失败记为学习者能力失败？

## 可见反馈与重试

公开检查区分输入校验、资源缺失、可重试服务故障、跨边界脱敏和诊断保留。提交不通过时会给出首个失败契约以及期望/实际字段；允许查看提示并重试。平台错误应单独记录，不能降低技能等级。

## 版本和证据

检查版本为 `0.1.0`，起始 ZIP 的 `starter-manifest.json` 固定起始文件 SHA-256。正式学习者证据需绑定课包/任务版本、起始快照哈希、提交内容哈希、评测版本和结果；只有未查看答案的独立提交才能成为技能证据。作者侧验证、参考实现或平台故障都不构成学习者技能变化。

从 ZIP 解压到全新目录，先按清单核对文件哈希，再运行 `cargo test --offline`。不要把修复后的工作目录重新打包为起始包。
