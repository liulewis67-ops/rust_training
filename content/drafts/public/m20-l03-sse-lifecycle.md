# M20-L03：SSE/WebSocket 与连接生命周期

## 学完后

- 根据消息方向选择 SSE 或 WebSocket；本课程把 SSE 作为主线，把 WebSocket 全双工实现留作挑战。
- 为每条 SSE 连接明确持有者、取消条件和资源回收路径。
- 通过响应流 drop、订阅数量和实际事件帧验证连接行为，避免 detached task 在客户端离开后继续占用资源。

## 先修

完成 M20-L02，理解 timeout、取消与重试的边界；掌握 Axum Router、Tokio stream 和 HTTP response body。SSE 使用普通 HTTP 响应将事件从服务端推向客户端；常见浏览器 `EventSource` 会自动重连，并可将最后收到的事件 ID 作为 `Last-Event-ID` 发送给服务端。SSE 是传输机制，事件存储和可靠恢复由应用另行保证。

## 先选通信方向

服务器持续通知浏览器、客户端主要用普通请求提交命令时，SSE 能复用 HTTP 请求/响应模型。其响应类型是 `text/event-stream`，事件帧有 `id`、`event`、`data` 等行并以空行结束。`Last-Event-ID` 可帮助服务器知道浏览器最后确认的事件位置，但它只是客户端游标，不是身份凭据或权限证明；断线重连后仍需重新认证和检查订阅授权。

只有当客户端和服务端都要在同一连接上频繁主动发送消息时，才考虑 WebSocket。主线把 WebSocket 标为挑战范围：RFC 6455 的握手、ping/pong、close frame、背压、消息大小限制、认证和代理超时需单独设计，不能把 SSE 的自动重连假设直接套用到 WebSocket。

## Axum SSE response 交给调用方

Axum 0.8.9 的 `Sse::new(stream).keep_alive(...)` 把一个事件 stream 包装为 SSE response；应用不需手工拼接 `Content-Type` 或写 HTTP chunk。Keep-alive comment 可帮助经过代理的空闲流保持可见，但不是业务事件，也不证明客户端仍会处理数据。

```rust
let stream = stream::unfold((receiver, subscription_guard), |(mut receiver, guard)| async move {
    match receiver.recv().await {
        Ok(update) => Some((Ok(Event::default().id(update.id).data(update.body)), (receiver, guard))),
        Err(broadcast::error::RecvError::Closed) => None,
        Err(broadcast::error::RecvError::Lagged(_)) => Some((Ok(resync_event()), (receiver, guard))),
    }
});
Sse::new(stream).keep_alive(KeepAlive::default())
```

片段仅示意所有权关系和事件 framing。真实 lag 行为需按数据源语义选择：跳过可能丢事件；发 resync 提示让客户端重新读取快照；持久日志则可根据 cursor 回放。不能悄悄把至少一次传输说成 exactly-once。

## 连接资源跟着 response stream 生命周期

每个打开连接可能占用 socket、任务、广播 receiver、队列槽位、数据库查询或租约。handler 创建订阅时，必须把该连接拥有的 receiver 和清理 guard 移入返回的 stream。客户端断开、router/body 被丢弃、发送端关闭或任务被取消时，stream drop 释放 guard，receiver 和其队列资源随之退出。

```rust
let guard = SubscriptionGuard::new(active_count);
let response_stream = stream::unfold((receiver, guard), |(receiver, guard)| async move {
    // poll receiver；每次产出事件时将 receiver 与 guard 一起交还给下次 poll。
});
```

不要用 `tokio::spawn` 启动一个永远等消息且不观察 stream cancellation 的 detached task；HTTP body 被丢弃不会自动取消任意 detached task。若连接工作必须独立 task 执行，就把 cancellation token 或关闭 channel 与任务一起持有，并在 disconnect/drop 时触发、await 或有界回收该 task。关闭方还要清理 subscriber registry，不能只减少一个计数。

SSE 自动重连会创建新的 HTTP request 和新的服务端订阅；服务端按每次请求重做认证、授权、限流与并发连接限制。`Last-Event-ID` 只能在服务端确认其属于当前订阅和保留窗口后用作回放 cursor。durable event replay、访问撤销后的流关闭、保留过期后的快照恢复属于后续持久化/实验合同，不由内存广播 crate 承诺。

## 如何验证真实断开路径

纯函数或只测 `200 OK` 都不能证明断开后资源回收。测试要先打开实际 Router response body，确认订阅数增加；再 drop body 或关闭消费端，确认订阅资源释放；两个客户端同时订阅时断开一个，另一个仍能收到下一条事件；多轮连接/断开不能让订阅数单调增长。接收测试使用有界 timeout，避免错误的流阻塞整个 test suite。

本节 public starter 使用本进程 broadcast 和计数 guard，只验证 Axum response stream 的所有权及 drop 行为。它不覆盖浏览器 EventSource 行为、HTTP/2/反向代理缓冲、生产连接容量、身份权限和持久事件回放。持久 `Last-Event-ID` 恢复见 I10-F02 合同及 M20-L04/M20-L05 后续内容。

## 分层提示

1. **方向提示**：服务端推送、客户端命令仍用普通 HTTP 时，哪些特性让 SSE 足够？什么业务才需要双向 WebSocket？
2. **所有权提示**：response body 被 drop 后，哪个对象仍持有 receiver 和计数 guard？Rust 所有权图会怎样变化？
3. **断连提示**：TCP 关闭、stream 结束、handler 返回和 `tokio::spawn` 任务结束是同一事件吗？
4. **重连提示**：浏览器自动重连是否会复用原 server-side receiver？服务端要重新执行哪些检查？
5. **游标提示**：`Last-Event-ID` 是不是身份凭据？客户端可以任意修改它吗？
6. **丢消息提示**：broadcast receiver lagged 后是跳过、发 resync 还是持久回放？不同选择怎样影响业务语义？
7. **测试提示**：只断言 Content-Type 或 200 为什么不能证明断连清理？怎样测试两个连接的独立生命周期？
8. **WebSocket 挑战提示**：RFC close handshake、ping/pong、背压和消息大小中的哪些资源规则仍需另行实现？

## 来源

- [WHATWG HTML Living Standard：Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html)：`text/event-stream`、EventSource reconnect、`Last-Event-ID` 和 `close()` 行为。
- [RFC 6455：The WebSocket Protocol](https://www.rfc-editor.org/rfc/rfc6455.html)：WebSocket 双向帧、Ping/Pong 与关闭握手；本单元只将其列为挑战范围。
- [Axum 0.8.9 SSE module](https://docs.rs/axum/0.8.9/axum/response/sse/) 与 [`KeepAlive`](https://docs.rs/axum/0.8.9/axum/response/sse/struct.KeepAlive.html)：响应流包装和 keep-alive 配置 API。

SSE framing/API 按以上当前规范和锁定版本核对。持久重放、鉴权、生产断连和代理行为需要各自的环境级验证；本节内存测试不替代这些验证。
