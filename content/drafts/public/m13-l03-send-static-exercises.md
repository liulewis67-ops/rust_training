# M13-L03 短练习：`Send` / `'static` 与 spawn

每题针对 `tokio::spawn`，分别检查借用生命周期和跨线程安全。不要用“当前 runtime 单线程”推翻 `tokio::spawn` 的约束。

## 预测：borrow、owned 与跨 await 状态

判断三个片段能否传给 `tokio::spawn`，分别指出 `'static` 或 `Send` 的结果：

1. `async { println!("{label}") }`，其中 `label` 是当前函数的 `String` 局部变量。
2. `async move { owned.len() }`，其中 `owned: String`。
3. `async move { let local = Rc::new(1); yield_now().await; drop(local); }`。

**公开契约**：逐项指出哪个变量被借用/拥有、是否被保存跨 await、Future 是否同时满足 `Send + 'static`。

**分层提示**：① 查看有没有短借用被 task 捕获。② move 只移动 Rc，不改变 Rc 的 trait。③ 判断 Rc 在 await 之后是否还活着。

## 修复：`async move` 仍不满足 Send

改写下列 Tokio task，让其保留 “await 之后读取同一字符串状态” 的行为并满足 `tokio::spawn` bounds。使用合适的跨线程共享类型，不可删掉 await 后的读取。

```rust
tokio::spawn(async move {
    let state = std::rc::Rc::new(String::from("ready"));
    tokio::task::yield_now().await;
    println!("{state}");
});
```

**公开契约**：运行时可跨线程调度；等待后仍能读取字符串；修复不能仅给 async block 添加 move。

**分层提示**：① 确认数据确实要跨 await 存活。② `Rc` 不实现 Send。③ 选 `Arc<String>`，或在创建 task 前构造 Arc 并 clone 所有权句柄。

## 实现：给 spawn 边界加编译验证

为 helper `spawn_owned_label` 实现一个 Tokio task：取得拥有的 `String`，在 task 内 await `yield_now()` 后返回其长度。补一段可执行测试，并另外添加两个 `compile_fail` doc tests：捕获局部借用、在 await 后使用 `Rc`。答案中解释两个负例分别触发哪一种边界错误。

**公开契约**：合法 helper 能返回 `JoinHandle<usize>` 并收集结果；两个非法示例必须分别因非 `'static` 借用与 Future 非 Send 而失败；不得通过删掉 await 后的使用掩盖问题。

**分层提示**：① helper 参数/返回类型标注所有权。② 正例将 String 移动进 async block。③ 对 Rc 负例确认 Rc 在 `.await` 之后仍使用；把 Rc 提前 drop 后该 Send 反例应不再成立。

参考答案和评测标准位于私有评测资料。
