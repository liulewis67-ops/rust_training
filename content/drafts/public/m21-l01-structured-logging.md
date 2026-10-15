# M21-L01：结构化日志、trace 与 request ID

## 学完后

- 用 span 表达一次请求的生命周期，用 event 记录发生的状态/失败类别。
- 让同一个经过验证或新生成的 `request_id` 同时贯穿 handler、错误响应与结构化日志。
- 记录可查询的低敏感字段，避免把 Authorization、Cookie、原始 body、用户输入或凭据放进日志。

## 先修

完成 M17-L03 Tower layer 顺序与 M17-L05 request context，理解 middleware 可以为成功和错误响应统一设置 ID。`request_id` 是应用侧关联键；它不等同于 W3C `trace_id`、数据库 transaction id 或用户身份。Distributed trace id 通常由 tracing subscriber/otel propagator 管理；不要把一个自制 request-id 填进别人的 traceparent。

## Span 是请求上下文，event 是发生的事实

Span 代表有范围的工作，例如 `http.request`，在异步 future 每次 poll 时重新进入，不要用跨 `.await` 的 `span.enter()` guard。请求 span 放 `request_id`、HTTP method、route template 和可选环境版本等关联字段。嵌套 span 可表示数据库 acquire/query 或后台任务 attempt，但 request span 结束后才算完成。

Event 表示某个时间点，例如 handler 的 `outcome="not_found"` 和最终 `http.status_code=404`。用固定字段而非拼接后的 message 表示检索维度：`request_id`、`http.route="/users/{id}"`、`http.request.method`、`http.response.status_code`、`duration_ms`、`outcome`。route template 比 `/users/42` 这类动态 URL 基数更低，也避免把资源 ID 混入普通日志。

```rust
let span = tracing::info_span!(
    "http.request",
    request_id = %context.request_id,
    http_request_method = %method,
    http_route = "/users/{id}",
);
let response = next.run(request).instrument(span.clone()).await;
tracing::info!(
    parent: &span,
    request_id = %context.request_id,
    http_route = "/users/{id}",
    http_response_status_code = response.status().as_u16(),
    duration_ms = elapsed.as_millis() as u64,
    outcome = "completed",
    "request completed"
);
```

上例只展示结构和异步 span 关联；duration 转换、HTTP middleware 与日志 schema 应按目标 runtime/collector 合同处理。Message 是给人读的简短说明，字段才是日志查询和聚合的稳定接口。字段名、类型和枚举值一旦被 dashboard/alert 使用，需要视作内部 schema 维护。

## Request ID 在边界生成、验证和回传

若可信上游提供 `X-Request-ID`，只接收有长度上限且无控制字符/换行的 token；非法值不能原样放进响应或日志。缺失/非法时使用碰撞概率合适的生成器。练习用递增计数器确保测试确定性，生产不能照搬。外层 middleware 将 `RequestContext` 放进 extensions，并为**所有** response，包括 extractor 错误、404 和 503，写回相同的 `X-Request-ID`。

Handler 的 span、service 调用和 response event 使用相同 ID。跨服务传播前遵循可信代理边界并限制长度；request ID 用于找日志，不能用于鉴权、租户授权或猜测其他对象。没收到 request-id 也应能在服务端关联一次请求。

## 日志最小化与可查询性

普通业务日志记录完成诊断所需的最少字段，不记录整条请求。禁止输出 Authorization、Cookie、session、密码、API key、完整 body、原始源码、query secret 或数据库连接串。不要把整个 error chain 的 `Display` 当稳定可公开字段：可以记录安全分类 `store_unavailable` 并按权限保留内部诊断，但边界要明确。

避免高基数、隐私维度成为 metric label，例如 `user_id`、每个 `request_id` 或 task ID。它们若确有排障需要，放在访问控制合适的结构化日志/span；指标使用 `route`、`outcome`、status class 等有限集合。日志与 trace 也有保留期、访问审计和字段 schema 演进要求，不是“structured”就自动安全。

## 本地验证范围

本节 Router starter 用自定义 `tracing::Subscriber` 采集 event fields，不依赖控制台文本或专用 collector。测试同时观察 HTTP response header/body 和实际 tracing field pairs，确保同一 ID 贯通、错误状态也关联、secret sentinel 不出现、route template 不含具体资源 ID。它不验证 OpenTelemetry exporter、采集器 redaction、跨服务 traceparent、生产密钥轮换或组织日志保留策略。

## 分层提示

1. 为什么 message 中拼接 `"request_id=... status=..."` 不等价于两个可查询字段？
2. Span 和 event 分别覆盖什么时间范围？异步 `.await` 后手工 enter guard 有什么风险？
3. response 是 404/503 时，request-id layer 是否还会设置响应 header 和 status event？
4. `/users/42` 与 `/users/{id}` 哪个作为普通 route log field 更适合聚合？
5. 哪些值绝不可进日志？需要保留内部诊断时怎样避免序列化全部 error 或输入？
6. request_id、trace_id、user_id 分别解决什么问题，为什么不能互换？
7. 高基数标识可放在哪个受控信号，哪些位置会让指标爆炸？

## 来源

- [tracing 0.1.44：Event](https://docs.rs/tracing/0.1.44/tracing/struct.Event.html)：事件与 span 关系，以及结构化字段语义。
- [tracing 0.1.44：`info_span!`](https://docs.rs/tracing/0.1.44/tracing/macro.info_span.html)：创建带字段的请求 span。
- [tracing 0.1.44：`Instrument`](https://docs.rs/tracing/0.1.44/tracing/trait.Instrument.html)：将 span 安全关联到异步 future 的 poll 生命周期。

字段集合与日志脱敏合同为项目教学约定；tracing API 按固定版本文档核对。作者侧本机 fixture 不替代正式 R3 采集链路与共用门槛 C。
