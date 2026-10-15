# M14-L01：JoinHandle 与任务结果

## 学完后

- 说明 `JoinHandle<T>` 是对 Tokio task 进行 await/join 并取回其结果的句柄。
- 区分任务返回的 `T`、任务内部业务 `Result<T, E>` 和 JoinError。
- 验证 task 成功、panic、abort 和 drop JoinHandle 后的行为。
- 不把丢弃句柄误当成取消，也不把“任务已安排运行”误当成“工作已完成”。

## 先修

完成 M13-L01–L06，理解 Future、runtime worker、`Send + 'static`、阻塞边界和混合负载的基本配额。本节只讨论普通 Tokio task 与 JoinHandle；协作取消、停机、`JoinSet` 和有界任务集合在后续单元处理。

## spawn 后任务与句柄

`tokio::spawn(future)` 启动一个 task 并返回 `JoinHandle<T>`。task 可在尚未 await 句柄时开始运行；句柄提供等待 task 完成、收集返回值和观察 task 级失败的入口。它表示 Tokio task，不表示额外 OS thread。

```rust
let handle = tokio::spawn(async { 20_u32 + 22 });
let task_result: Result<u32, tokio::task::JoinError> = handle.await;
assert!(matches!(task_result, Ok(42)));
```

JoinHandle 的 `Future::Output` 是 `Result<T, JoinError>`。若 task 自己返回业务结果，外层还会包住业务 `Result`：

```rust
let handle = tokio::spawn(async { Err::<u32, &'static str>("invalid record") });
let task_result: Result<Result<u32, &'static str>, tokio::task::JoinError> = handle.await;
assert!(matches!(task_result, Ok(Err("invalid record"))));
```

这里 task 正常结束了，所以外层是 `Ok`；内层 `Err` 是业务错误。不要把两层错误压成一个含糊的 panic/error 字符串，也不要用 `unwrap` 把所有情况合并。

## 成功、panic 与取消

正常 return 得到 `Ok(value)`。task panic 不会作为正常返回值交付；await 返回 `Err(JoinError)`，可用 `is_panic()` 区分 panic。被 abort 并实际取消的 task 则以 `is_cancelled()` 区分。JoinError 是 task 执行状态，不能替代 task 自己设计的业务错误类型。

```rust
let panicking = tokio::spawn(async { panic!("controlled task failure") });
let panic_result = panicking.await;
assert!(panic_result.is_err_and(|error| error.is_panic()));
```

本节样例另用一个等待 oneshot 的 task，先调用 handle.abort() 再 await，以确定性地观察取消结果。这里的 abort 仅介绍可取消 Tokio async task 的边界；对已经开始的 `spawn_blocking` closure 不能类推。

## drop 句柄会 detach

丢弃 `JoinHandle` 会 detach task：只要 runtime 仍在运行，task 会继续在后台执行，但调用方失去 join 它和取回返回值的途径；runtime shutdown 是另一个生命周期边界。若 task 内持有资源、permit 或错误结果，不能因为外层 handle 被 drop 就认为工作已停止或资源已释放。

下例用 side-channel 证明 detached task 仍完成；这个额外 oneshot 是观察证据，原 task 的 `u32` 返回值仍未通过 JoinHandle 取回：

```rust
let (release_tx, release_rx) = tokio::sync::oneshot::channel();
let (done_tx, done_rx) = tokio::sync::oneshot::channel();
let handle = tokio::spawn(async move {
    let _ = release_rx.await;
    let _ = done_tx.send(());
    42_u32
});
drop(handle); // detach，不会向 task 发送取消请求
let _ = release_tx.send(());
done_rx.await.expect("detached task signals completion");
```

如果需要可靠收集多个 task 的结果，应保留并管理各个 handle 或使用后续学习的 task 集合。若需要取消，应设计明确的 abort 或协作取消协议；不要依赖 drop 的副作用。

## `select!` 中等待 handle

等待 `&mut JoinHandle<T>` 是 cancel safe：若 `tokio::select!` 的另一分支先完成，本轮对 handle 的等待取消不会丢掉 task 的输出，handle 仍能在后续继续 await。本节只说明结果不会因该次 select 等待而丢失；timeout 之后是否让 task 继续或主动取消，是调用方策略。

## 分层提示

1. **类型提示**：task 返回 `Result<T, E>` 时，`JoinHandle` await 后有几层结果？
2. **失败提示**：外层 `JoinError` 与 task 内部业务 `Err` 各表示什么？
3. **所有权提示**：谁拥有 JoinHandle？drop handle 后 task 和返回值分别怎样？
4. **验证提示**：用 gate/oneshot 控制 task 尚未完成时 drop handle，再用独立完成信号观察后台 task。
5. **取消提示**：对普通 async task 的 abort 结果与 `spawn_blocking` 的开始后取消边界不能混为一谈。

## 来源

- [Tokio API：`JoinHandle`](https://docs.rs/tokio/latest/tokio/task/struct.JoinHandle.html)
- [Tokio API：`JoinError`](https://docs.rs/tokio/latest/tokio/task/struct.JoinError.html)

官方文档用于核对 JoinHandle 的 task/output 关系、detach、cancel safety 及 JoinError 分类；教学任务、控制案例和练习为原创。作者稿尚未通过路线图要求的固定 R2 环境、独立学习者验收或正式课程接入。
