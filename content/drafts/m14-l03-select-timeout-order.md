# M14-L03：select、超时与完成顺序

## 学完后

- 说明 `tokio::select!` 在当前 task 中并发轮询分支，首个完成分支的 handler 执行，其余分支 future 被 drop。
- 不对同时 ready 的分支顺序作无依据假设；理解 `biased;` 的显式顺序与公平性责任。
- 区分 timeout 返回 Elapsed、内层 future 被 drop，以及被等待的 spawned task 是否仍受跟踪。
- 用 `JoinSet::join_next` 按完成顺序收集任务，并保留 task 级 JoinError。

## 先修

完成 M14-L01–L02，理解 JoinHandle 的返回/失败类型和 channel 的 gate 通知。本节不覆盖生产服务的有界 admission 和背压（M14-L04），也不定义全服务取消/停机政策。

## select 等待多个分支

`select!` 把多个 async expression 放在当前 task 上轮询；它们可并发推进，但不会因此在多个 OS thread 上并行。首个匹配的 ready 分支执行 handler，其他分支 future 被取消（drop）。

默认情况下，Tokio 会随机选择轮询起点来避免循环中某个持续 ready 的分支固定垄断先 poll 机会。因此，当多个分支同时 ready 时不能承诺某一分支先执行。`biased;` 可指定从上到下的轮询顺序，但如果前面的分支不断 ready，公平性由调用方负责。

```rust
let selected = tokio::select! {
    left = left_rx => Selection::Left(left),
    right = right_rx => Selection::Right(right),
};
```

这段代码在两个 receiver 都 ready 时不保证固定左/右。测试应允许两种合法结果，或只预先释放一个 gate 来验证那个唯一 ready 的分支。还要检查分支 Future 是否 cancellation safe；select 循环中取消某些 I/O future 会丢失已读/已写进度。

## timeout 与 handle 所有权

`tokio::time::timeout(limit, future).await` 返回 `Result<T, Elapsed>`。期限内完成为 `Ok(value)`；到期为 `Err(Elapsed)`，被包装的 future 被取消并 drop。timeout 先 poll 内层 future；同步阻塞期间不 yield 的 future 可能在 timer 得到检查前就超过限时完成，所以 timeout 不是强制抢占。

若对一个**借用**的 `&mut JoinHandle<T>` 做 timeout，到期只结束这一轮等待；原 handle 仍由调用方持有，可以继续 await 或按明确政策 abort。若把 JoinHandle 按值移进 timeout，timeout Future 被 drop 时也会 drop handle，task 会 detach 并且返回值失去收集路径。需要处理超时后的结果时，先决定谁持有 handle，再写 timeout。

```rust
use std::time::Duration;

let mut handle = tokio::spawn(async { 42_u32 });
let first_wait = tokio::time::timeout(Duration::ZERO, &mut handle).await;
if first_wait.is_err() {
    // handle 仍可 await；这里没有因 timeout 自动取消 task。
    let task_result = handle.await;
    assert!(matches!(task_result, Ok(42)));
}
```

对于还没有 spawn 的 inline future，timeout 到期会 drop 该 Future；这和借用 `&mut JoinHandle` 等待已 spawn task 的后果不同。deadline/Elapsed 本身也不保证外部副作用可撤销。

## 多任务完成顺序

顺序 await 一组 JoinHandle 通常是按句柄的 await 顺序收集，较慢的前项会挡住后项已完成的结果。`JoinSet::join_next()` 等待任一 tracked task 结束，按完成顺序交付 `Result<T, JoinError>`；它不承诺 spawn 顺序。若多个 task 已同时完成，它们之间也不应使用固定次序作正确性依据。

```rust
let mut tasks = tokio::task::JoinSet::new();
tasks.spawn(async { "first to finish" });
tasks.spawn(async { "another task" });
while let Some(task_result) = tasks.join_next().await {
    // 逐项处理 Ok(value) 或 JoinError，收集顺序来自实际完成顺序。
}
```

JoinSet 被 drop 时会 abort 它仍跟踪的 task，因此它也明确承担 task 生命周期。若需要 detach，必须有意识地移出 task；不能把 JoinSet 和普通 `JoinHandle` 的 drop 行为混为一谈。

## 分层提示

1. **ready 提示**：若两个 oneshot receiver 都已有值，`select!` 默认承诺哪个分支先返回吗？
2. **取消提示**：某分支落选时，是 handler 不执行，还是 Future 也继续留在原处？
3. **超时提示**：timeout 包的是 owned JoinHandle，还是 `&mut JoinHandle`？Elapsed 后谁还拥有 handle？
4. **完成提示**：顺序 await 与 JoinSet `join_next` 分别按什么顺序给调用方结果？
5. **测试提示**：用 oneshot release gate 单独放行一个任务；需要同时放行时只断言集合，不断言固定 tie order。

## 来源

- [Tokio macro：`select!`](https://docs.rs/tokio/latest/tokio/macro.select.html)
- [Tokio API：`time::timeout`](https://docs.rs/tokio/latest/tokio/time/fn.timeout.html)
- [Tokio API：`JoinSet`](https://docs.rs/tokio/latest/tokio/task/struct.JoinSet.html)

官方资料用于核对 select 轮询与取消、timeout future-drop 边界、JoinSet 完成顺序与生命周期；场景和 gate 实验为原创。作者稿尚未通过正式 R2 与独立学习者验收。
