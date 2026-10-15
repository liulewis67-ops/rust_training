# M17-L04：接口分层、路由测试与依赖替身

## 学完后

- 将 HTTP handler 面向应用定义的存储 trait，而不是直接调用某个具体数据库或内存实现。
- 在 Router startup 注入实现，使测试可以替换依赖而不改变 path、status 或 JSON 契约。
- 用替身验证路由真正调用注入实现，避免只测默认内存 store 的假隔离。

## 先修

完成 M17-L03，了解 middleware 和完整 Router 请求测试。本节把 AppState 放在 handler 与存储接口之间；async repository、真实 SQL 连接池与数据库测试由 M18 展开。示例接口同步且确定性，不声称其适合阻塞式数据库 I/O。

## handler 依赖行为契约

handler 所需的是“按 ID 查用户”的行为，不一定是某个 `MemoryStore`。定义 `UserStore: Send + Sync`，让 `AppState` 持有 `Arc<dyn UserStore>`；生产组装可以传内存实现或后续适配的持久化实现，HTTP handler 仍只认接口。

```rust
trait UserStore: Send + Sync {
    fn find_user(&self, id: u64) -> Result<Option<User>, StoreError>;
}

#[derive(Clone)]
struct AppState {
    store: Arc<dyn UserStore>,
}
```

trait object 提供动态分派的接口边界；若要静态分派，也可将 store 类型做泛型参数。这里选择 `Arc<dyn UserStore>` 是为了让路由持有可 clone 的共享依赖，且测试可注入结构不同的 store。接口只暴露本应用需要的操作，不应照抄数据库客户端 API。

## 组装边界负责注入

在构造 router 时接收 `Arc<dyn UserStore>` 并放入 AppState。handler 从 `State<AppState>` 调用 trait 方法，再把结果映射为公开 API 错误。若 `app(store)` 重新创建 MemoryStore 或把 trait object 丢弃，测试即使初始默认样例成功，也没有真正验证可替换性。

完整 HTTP 测试需要构造一个独特替身，例如对 ID 77 返回名字 Injected，并只通过 Router 发请求。观察到 77/Injected 才能证明 startup 参数到 AppState、State extractor 和 handler 的整条依赖链都接通。直接调用 fake 的方法只证明 fake 自己工作。

## 替身保持公开契约不变

用内存 store 和测试替身分别运行相同 route：合法用户返回 200 JSON，missing 返回 404，底层故障按稳定的 503 分类。替换依赖不应要求测试改 URL、解析方式或成功状态。这是接口隔离的可观察价值，而不是为了“有 trait”而额外抽象。

本练习的 sync trait 用于纯内存实现，避免把阻塞 I/O 放进 async handler。真实 async 数据库接口的生命周期、trait object 和连接池策略需要单独设计，不在本节假装解决。

## 分层提示

1. **边界提示**：哪一层知道数据库类型，哪一层只需知道 find_user 行为？
2. **替换提示**：如何让测试替身返回默认 store 没有的 ID/name？
3. **观察提示**：通过完整 HTTP response 验证注入，比断言 fake 被构造多了哪些证据？
4. **契约提示**：替换 store 后哪些公开状态与 JSON 仍应保持？
5. **抽象提示**：这个 trait 的方法是否恰好覆盖 handler 用例，还是泄漏了底层 API？
6. **异步提示**：为什么这里用同步内存 trait 不等于推荐同步调用真实数据库？

## 来源

- [Axum 0.8.9 State](https://docs.rs/axum/0.8.9/axum/extract/struct.State.html)：共享 app state 与 handler 的注入边界。
- [Axum 0.8.9 Router](https://docs.rs/axum/0.8.9/axum/routing/struct.Router.html)：Router state 和 with_state。
- [The Rust Reference：trait objects](https://doc.rust-lang.org/reference/types/trait-object.html)：dyn trait object 的类型语义。

trait 替身与路由可替换性练习为原创；状态与 trait object 语义据固定版本官方文档核对。真实数据库、异步连接池及 R3 验收不在作者样例范围。
