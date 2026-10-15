# M17-L02：业务错误和服务错误

## 学完后

- 区分客户端输入/业务结果、资源不存在和底层服务故障。
- 使用应用拥有的错误 enum 将内部错误映射为稳定 status/code/message。
- 在内部保留 `Error::source`/tracing 诊断能力，不把连接串、查询细节或错误栈返回给 client。

## 先修

完成 M17-L01 和 M16-L04，能注入 AppState 并为错误实现 `IntoResponse`。本节定义 handler 与 service 的错误边界；request-id/tracing 关联以及 middleware 链在 M17-L03/M17-L05 展开。

## 把错误按来源分类

- **业务/输入结果**：缺少必需字段、字段违反规则，或资源确实不存在。client 可以修输入或根据 404 选择其他动作。
- **service/依赖错误**：数据库池暂时不可用、远端依赖超时、存储层内部数据损坏。client 通常不能通过改字段解决。
- **程序错误**：违反内部不变量或 bug。要告警并留诊断，不能掩盖为正常 404。

领域层可以用自己的 `DomainError` 表达业务边界；持久层用 `StoreError` 包装具体失败；HTTP handler 再将这些类型映射为 `ApiError`。这避免 service 依赖 HTTP，同时让 Axum 边界选择公开状态。

```rust
enum ApiError {
    InvalidInput,
    NotFound,
    StoreUnavailable(StoreError),
}
```

对外状态依契约选择：例子中 bad input 是 400，未找到是 404，当前无法提供服务是 503。一个 API 也可把 business validation 单独定义为 422；关键是有意且一致，不要把所有 `Err` 都显示成 400/404。

## 错误 source 留在内部诊断

`std::error::Error::source` 可让 `ApiError` 在 HTTP 映射前保留底层 `StoreError`。负责边界映射的服务应把经过过滤的诊断写入受信任 telemetry；不要把原始错误链自动复制到日志或 client response。公开 `ErrorBody` 只承诺稳定 code 和通用 message。数据库 URL、SQL 参数、文件路径和内部 host 既不应进入 response，也不能未经脱敏就写入日志；原始依赖错误文字同时会增加信息披露风险并成为脆弱的 API 兼容负担。

```rust
impl std::error::Error for ApiError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::StoreUnavailable(source) => Some(source),
            _ => None,
        }
    }
}
```

本样例保留 source 链供受控的内部诊断流程使用，但不输出原始 source；日志过滤与 request correlation 在 M17-L03/L05 讨论。本节不连接真实 database。

## 测试每个错误边界

从完整 Router 发送合法用户、未知用户、格式非法 ID 和预置 service failure。断言 success/status/code/message，并证明公开 body 不包含人为注入的内部连接串。业务 not found 与依赖不可用不能都变成同一状态，否则客户端和运维都失去恢复线索。

## 分层提示

1. **责任提示**：哪层知道 SQL/网络故障，哪层决定 HTTP status？
2. **分类提示**：不存在资源、无效输入和 store offline 各能采取什么恢复动作？
3. **source 提示**：`Error::source` 与公开 response message 是否必须相同？
4. **信息提示**：把连接 URL 放到 503 body 会泄漏什么？
5. **可维护性提示**：依赖升级改变错误 wording 时，为什么稳定 code 比直接返回错误字符串可靠？
6. **验证提示**：如何用固定故障变体证明依赖失败不会被误报成 404 或 200？

## 来源

- [Axum `IntoResponse`](https://docs.rs/axum/0.8.9/axum/response/trait.IntoResponse.html)：自定义 API error 到 status/body 的映射。
- [Rust 1.95 `std::error::Error`](https://doc.rust-lang.org/1.95.0/std/error/trait.Error.html)：错误链和 source 诊断边界。
- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html)：HTTP 4xx/5xx status 语义。

错误层级和 failure injection 是原创练习；status/source API 语义按指定官方文档核对。作者稿不是正式 R3 服务验证或安全审计。
