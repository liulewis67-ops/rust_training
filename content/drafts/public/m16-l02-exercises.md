# M16-L02：Router、handler 与启动短练习

## 预测：Router 状态类型与启动边界

给定 `fn routes() -> Router<AppState>`，其中 handler 提取 `State<AppState>`。说明这里的 `AppState` 是已经装入 router 的状态还是尚缺的状态；还需要什么调用才能将其交给 `axum::serve`？另区分 `Router::new()` 未匹配 path、path 匹配但 method 不匹配、listener bind 失败三种结果。

提示：Router 泛型表示缺少的 state；HTTP route fallback 和 socket bind 不在同一层。

## 修复：组合共享状态并暴露 health route

修复 `app(state)`，让服务暴露 `GET /healthz`，返回包含 service 名称和版本的 JSON；`GET /absent` 必须返回 404。不要在 handler 中绑定端口或捕获全局可变变量。

提示：先写 `routes() -> Router<AppState>`，再提供 state；用 `Router::oneshot` 观察真实 router 行为。

## 实现：启动本地 server 并处理访问

实现一个接收 `TcpListener` 和已构造 router 的启动函数，使用 `axum::serve` 驱动服务。测试使用 `127.0.0.1:0`、从 `local_addr()` 取得端口，并通过 TCP 请求 health path 与 unknown path。地址解析或 bind 失败要返回带上下文的错误。

提示：不必固定占用某个端口；测试 server task 应在断言结束后 abort 并 await 其 handle，避免遗留 task。
