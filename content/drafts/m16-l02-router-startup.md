# M16-L02：Router、handler 与启动

## 学完后

- 解释 `Router<S>` 的 `S` 表示路由还缺少的状态，并在 serve 前提供所需状态。
- 把 handler、路由表、共享应用状态和启动入口分层组合。
- 从可验证的 listener 启动 Axum 服务，区分 bind 失败、服务退出和未知路由。

## 先修

完成 M16-L01，理解 method/path 与 response contract。本节用 `/healthz` 展示 Router 构造和进程启动；持久化与统一 middleware 错误边界留到后续课程。作者侧草案的正式课程实施依赖 I09-F02 和 R3 验收。

## Router 保存路由，不负责监听

`Router` 将 path、method 与 handler 组合成一个可调用服务。`Router::new()` 没有 route 时默认返回 404。给路由表设定明确函数边界，可以在进程启动前通过 `oneshot` 测试 path 与 handler 的组合；只有传入 listener 并调用 `axum::serve` 后才开始接收网络连接。

```rust
fn routes() -> Router<AppState> {
    Router::new().route("/healthz", get(health))
}

fn app(state: AppState) -> Router {
    routes().with_state(state)
}
```

Axum 的 `Router<S>` 中，`S` 是此 router 尚缺少的 state 类型。`routes()` 的 handler 提取 `State<AppState>`，因此返回 `Router<AppState>`。调用 `with_state(state)` 提供这个 state 后，结果是无缺失 state 的 `Router<()>`，即可传给 `serve`。不要把类型参数误读成 router 已经持有的状态。

## handler 只处理请求，不绑定端口

handler 通过 extractor 声明请求输入：`State<AppState>` 取得 router 共享状态；`Path`、`Query` 和 `Json` 则从当前请求提取数据。handler 返回 `IntoResponse`，由 Axum 转成 HTTP response。让 handler 只处理输入与响应，Router 负责组合路径和 method，启动函数负责 parse 地址、bind listener 与 serve，可以分别定位失败发生在哪个边界。

```rust
#[derive(Clone)]
struct AppState { service: &'static str, version: &'static str }

async fn health(State(state): State<AppState>) -> Json<Health> {
    Json(Health { service: state.service, version: state.version })
}
```

Router 默认 fallback 处理没有匹配的 path，返回 404。若应用选择自定义 fallback，需令其响应仍符合 HTTP contract；不要把未知 path 伪装为 200。方法不匹配属于匹配 path 上的 MethodRouter 行为，见 M16-L01。

## 启动顺序让错误可定位

一个简单启动过程是：读取配置地址 → parse 成 `SocketAddr` → `TcpListener::bind` → 构建完整 state/router → `axum::serve`。parse 或 bind 失败时，进程应以错误退出并指出对应配置/操作，不能打印“启动成功”后继续，也不应把运行中的 server error 吞掉。

将启动逻辑抽成接收 `TcpListener` 的 async 函数，测试可先 bind 到 `127.0.0.1:0` 让操作系统挑可用端口，再用返回的本地地址访问服务；这避免固定端口冲突。handler/router 测试不需 socket，启动路径 smoke test 则验证 listener、serve 和真实 HTTP 编解码链路。未知 path 的请求应回 404，正常 health 请求应回 200。

## 分层提示

1. **类型提示**：`Router<AppState>` 表示什么尚未完成？可以直接传给 `axum::serve` 吗？
2. **边界提示**：handler、Router、listener 和 serve 各自负责哪一类工作？
3. **状态提示**：几个 handler 需要同一配置时，state 要在哪里构造并提供？
4. **启动提示**：地址无法 parse、bind 失败和 server future 返回错误分别应如何报告？
5. **验证提示**：什么行为适合 `Router::oneshot`，什么行为必须经过实际 TCP listener？

## 来源

- [Axum `Router`](https://docs.rs/axum/0.8.9/axum/routing/struct.Router.html)：路由组合、fallback、`Router<S>` 和 `with_state`。
- [Axum `State`](https://docs.rs/axum/0.8.9/axum/extract/struct.State.html)：handler 中提取 router state。
- [Axum `serve`](https://docs.rs/axum/0.8.9/axum/fn.serve.html)：listener 与 router 的服务启动入口。
- [Axum `Serve`](https://docs.rs/axum/0.8.9/axum/serve/struct.Serve.html)：服务 future 和 graceful shutdown API。

Axum 官方 API 用于核对状态类型、路由 fallback 和 server 生命周期；service state、health endpoint 与错误处理练习为原创。此作者稿没有完成正式 I09 前置、R3 隔离环境或独立学习者验收。
