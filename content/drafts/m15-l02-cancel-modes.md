# M15-L02：drop handle、abort 与协作取消

## 学完后

- 区分 drop `JoinHandle` 的 detach、`abort()` 的异步停止请求和应用级协作取消信号。
- 在需要结果时保留 JoinHandle，并 await abort 终态；不把 `is_finished()` 当成 abort 已完成的同步屏障。
- 为协作取消定义停止接收、释放当前资源、返回任务终态和清理责任。

## 先修

完成 M15-L01，理解 future drop、取消安全与半完成状态。此处只讨论 Tokio async task 的 abort 与协作停止；M15-L03 会把它放入 deadline 与优雅停机流程。`spawn_blocking` 已经运行的 closure 不能被 abort 强制抢占。

## 三种不同操作

| 操作 | 任务状态 | 结果路径 | 调用方要做什么 |
|---|---|---|---|
| drop `JoinHandle` | detach，task 在 runtime 仍运行时继续 | 原 JoinHandle 返回值不可再收集 | 若需要观察完成，用 side channel / tracker 明确建立生命周期；不把 drop 当取消 |
| `handle.abort()` | 请求 Tokio async task 在可取消点停止 | task join 通常得到 cancelled `JoinError`；若 task 已完成可返回原结果 | await 原 handle 确认最终状态并处理资源归还 |
| 协作取消信号 | task 按应用协议执行清理并返回业务终态 | JoinHandle 可得到如 `Cancelled` 的正常输出 | 定义取消优先级、清理和无法及时响应时的 deadline/abort 兜底 |

`abort()` 是调度请求，不是瞬间抢占。发出 abort 后 `is_finished()` 仍可能暂时为 false。若需要证明资源已清理，await handle 并检查退出结果。异步 task 的 drop 会析构其持有的局部值，但这不保证外部副作用可撤销。

## 协作取消让 task 自己收尾

任务可用 oneshot、watch channel 或取消 token 接收停止信号，在循环边界 `select!` 取消与工作事件。取消分支要释放业务资源、回传未完成工作、写入终态或发送完成通知，再从 task 返回。信号发送只表示“请求停”，不是清理已经完成；JoinHandle/TaskTracker 等待才是完成屏障。

```rust
let outcome = tokio::select! {
    _ = cancel_rx => {
        cleanup().await;
        WorkerOutcome::Cancelled
    }
    result = current_job => WorkerOutcome::Completed(result),
};
```

这个模式要求 `current_job` 能安全地被取消，或已明确其副作用策略。若选项 future 不是 cancel-safe，应把状态保存在外部、改用消息驱动阶段，或先完成不可取消的短临界步骤，再响应信号。

## drop / abort 的边界

drop handle 会丢弃 join 权限并 detach，而不是向 task 发送取消通知。abort 用于尽快丢弃 Tokio async task 的 future；CPU 忙循环或同步阻塞段若不让出执行权，就无法立刻响应。已运行的 `spawn_blocking` closure 更不能被 abort 停止；必须把可检查的取消信号传进 closure 或接受它运行完。

若上层要确保任务已结束，应保留 JoinHandle，或者采用有明确 close/wait 生命周期的任务跟踪器。只保存 AbortHandle 能触发 abort，但不能代替结果收集。

## 分层提示

1. **drop 提示**：丢掉 JoinHandle 后 task 继续运行吗？其返回值还能 await 吗？
2. **abort 提示**：调用 abort 后是否已经完成清理？如何观察 task 进入终态？
3. **协作提示**：取消分支需完成哪些业务动作，再返回哪个 task 结果？
4. **阻塞提示**：async task abort 与同步 `spawn_blocking` 的 abort 边界相同吗？
5. **协议提示**：发送取消请求和确认任务已经停止，是不是同一事件？

## 来源

- [Tokio API：`JoinHandle`](https://docs.rs/tokio/latest/tokio/task/struct.JoinHandle.html)
- [Tokio API：`AbortHandle`](https://docs.rs/tokio/latest/tokio/task/struct.AbortHandle.html)
- [Tokio task module：task lifecycle and cancellation](https://docs.rs/tokio/latest/tokio/task/index.html)
- [Tokio API：`spawn_blocking`](https://docs.rs/tokio/latest/tokio/task/fn.spawn_blocking.html)

官方文档用于核对 detach、abort 请求、JoinError 和 blocking closure 的停止限制；worker 协作取消协议与 gate 演练为原创。作者稿尚未通过正式 R2 与独立学习者验收。
