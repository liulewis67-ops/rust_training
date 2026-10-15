# M17-L01：State、AppState 与子状态

## 学完后

- 区分应用级共享 `State` 与每次请求派生的身份/参数数据。
- 将多路由所需配置聚合为 cloneable `AppState`，在启动边界提供完整状态。
- 使用 `FromRef<AppState>` 为 handler 提取最小子状态，避免隐式全局依赖。

## 先修

完成 M16-L02 与 M16-L06，理解 Router state 参数、`with_state` 和陌生资源 API。本节只讨论状态归属/投影；业务错误、middleware 的状态访问和服务层边界在后续单元继续。此为作者侧草案，正式 M17 实施依赖 M16 和 I09-F02/R3。

## AppState 表达服务生命周期共享值

Axum `State<T>` 从 Router 提供的共享 state 提取数据。它适合配置、连接池句柄、服务版本或并发共享仓储；值随应用/router 生命周期创建，由多个请求共享。不要在 handler 中读取隐式 global static、环境变量或可变 singleton 来绕过依赖边界，也不要把每次请求派生出的 user/session identity 当成全局 app state。

```rust
#[derive(Clone)]
struct AppState {
    health: HealthState,
    metrics: MetricsState,
}

let app = routes().with_state(app_state);
```

Router 通过 `with_state` 注入状态；从 `Router<AppState>` 到可 serve 的 router 类型边界与 M16-L02 相同。Clone 是为了把 router state 安全交给 Axum service；昂贵的共享资源通常放 `Arc` 或连接池句柄中，clone 句柄而不是复制底层连接/整个数据集。

## handler 应只拿需要的子状态

若 health handler 只需要 service/version，而 metrics handler 只需要 counter，给两个 handler 都传入包含全部 secrets/pools 的大 AppState 会扩大耦合。通过 `FromRef<AppState>` 提取 handler 所需的最小子状态：

```rust
impl FromRef<AppState> for HealthState {
    fn from_ref(app: &AppState) -> Self { app.health.clone() }
}

async fn health(State(state): State<HealthState>) -> Json<Health> { /* ... */ }
```

投影函数是显式依赖映射：每个 field 从 AppState 中正确复制/clone 出来。错误投影即使类型通过编译，也可能让 handler 读到默认值、旧设置或不相干子系统的数据。针对每个 State handler 用 HTTP 测试检查实际 response，可以发现这类“类型正确但值来源错”的问题。

## Arc 和锁留在共享所有权边界

配置通常创建后不变，可直接 clone 小值或 clone `Arc<Config>`。可变内存 store 可放 `Arc<RwLock<Store>>`，每次只在同步短临界区读取/更新，不持锁跨 await。SQL pool 一般本身提供廉价 clone handle；不要额外重复套 `Arc<Mutex<Pool>>`，除非有具体同步语义需要。

状态模型还应说明谁创建、在哪个 Router 注入、哪个 handler 能看到。对 helper 函数传递具体子状态比隐式访问整份 AppState 更容易替换和测试。

## 分层提示

1. **生命周期提示**：配置、pool 与当前用户身份分别是 app 生命周期还是 request 生命周期？
2. **所有权提示**：为什么 Router state 需要可 clone，而 Clone 不一定表示深拷贝所有资源？
3. **子状态提示**：一个 handler 只需只读版本信息，是否必须拿含数据库 pool/密钥的全量状态？
4. **映射提示**：`FromRef` 中哪条显式映射决定 handler 真正读到的字段？
5. **测试提示**：如何从 HTTP response 证明 substate 投影不是默认值或错字段？
6. **边界提示**：哪些信息不应使用全局 static 让 handler 隐式获得？

## 来源

- [Axum `State`](https://docs.rs/axum/0.8.9/axum/extract/struct.State.html)：共享 router state、子状态和 request 派生数据的边界。
- [Axum `FromRef`](https://docs.rs/axum/0.8.9/axum/extract/trait.FromRef.html)：从主状态引用构造 cloneable 子状态。
- [Axum `Router`](https://docs.rs/axum/0.8.9/axum/routing/struct.Router.html)：Router<S> 与 `with_state` 的注入位置。

State lifecycle、FromRef 与 Router typing 来自 Axum 0.8.9 官方 API；健康/metrics 示例和错误投影测试为原创。作者稿未通过正式 R3 与独立学习者验收。
