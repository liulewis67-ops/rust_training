# M17-L03：Tower Layer、执行顺序与请求追踪

## 学完后

- 解释 Router.layer 如何包装已有路由，以及请求与响应经过多层的顺序。
- 从确定性的事件记录还原外层 middleware、内层 middleware、handler 的进入和返回顺序。
- 设计不记录凭据、请求 body 或未经筛选 header 的轻量请求追踪。

## 先修

完成 M17-L02，理解错误边界与不把内部信息写进公开响应。本节用 Axum middleware API 观察 Tower Layer 组合；request-id 与统一错误上下文由 M17-L05 展开。

## 每个新 layer 会包住此前路由

Axum Router.layer 会应用在调用时已经加入的 routes。每次调用把新的 layer 包在现有 router 外面，因此请求按最近添加的 layer、较早的 layer、handler 顺序向内；response 按反方向返回。可把请求路径写成一张手工表，再用事件记录验证，而不是凭链式代码缩进猜顺序。

```rust
let app = Router::new()
    .route("/trace", get(handler))
    .layer(inner_layer)
    .layer(outer_layer);
```

顺序是 outer request → inner request → handler → inner response → outer response。如果要在 Axum 里采用从上到下顺序构建多个 Tower layer，也可使用 ServiceBuilder；选定一种后，以实测事件为准。

## middleware 在 next 前后包围 handler

`from_fn_with_state` 将 cloneable state 提供给异步 middleware。middleware 在 `next.run(request).await` 之前执行 request-side 逻辑，await 完成后观察 response。多个 middleware 会形成嵌套调用，故进入/退出必须成对解读。

```rust
async fn observe(request: Request, next: Next) -> Response {
    record("observe:enter");
    let response = next.run(request).await;
    record_status(response.status());
    response
}
```

示例中的 EventLog 是确定性测试探针，不是生产日志实现。它只存 stage 名称和状态数字，不保存 header、query、body 或认证信息。生产 tracing 可创建 request span 并记录低敏感的 route template、状态和耗时；输入值、token、Cookie、数据库 URL 必须省略或先脱敏。

## 观察完整嵌套而不是只测 handler

从完整 Router 发一个 HTTP request 并比较整个事件序列，可同时确认入口顺序、handler 是否执行、response 是否向外返回。单测 middleware helper 无法证明组装后的 layer 顺序。若 handler 提前返回、extractor 拒绝请求或 middleware 短路，事件路径会不同；测试应明确本练习检查的是正常 handler 成功路径。

事件的逻辑顺序应为：

1. `outer:enter`
2. `inner:enter`
3. `handler`
4. `inner:exit:200`
5. `outer:exit:200`

加入新 layer 后更新预期事件并确认敏感值仍不会进入记录。不要用 timing 假设推断顺序；一个 request 中同步写入的事件就是可复现证据。

## 分层提示

1. **包装提示**：两次调用 Router.layer，哪次的 layer 最先拿到 request？
2. **往返提示**：为什么 enter 顺序与 response exit 顺序相反？
3. **观察提示**：完整 Router 上的事件序列比直接调用 middleware 函数多证明了什么？
4. **泄漏提示**：为何不能为“方便排查”记录完整 Authorization header 与 request body？
5. **故障提示**：如果 middleware 不调用 next，哪些事件和 handler 行为会消失？
6. **追踪提示**：生产 span 需要哪些最少字段，才能关联状态与耗时而不过度采集？

## 来源

- [Axum 0.8.9 middleware](https://docs.rs/axum/0.8.9/axum/middleware/index.html)：Tower 集成、Router middleware 应用和 layer 执行次序。
- [Axum 0.8.9 from_fn_with_state](https://docs.rs/axum/0.8.9/axum/middleware/fn.from_fn_with_state.html)：异步 middleware、state 与 Next 的调用契约。
- [Axum 0.8.9 Router](https://docs.rs/axum/0.8.9/axum/routing/struct.Router.html)：layer 应用到已登记 route 的规则。

本节的事件序列、测试探针和信息最小化练习为原创；API 语义据 Axum 固定版本文档核对。作者稿不代表正式 R3 或独立学习者验收。
