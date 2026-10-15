# M15-L03：优雅停机、清理与截止时间

## 学完后

- 区分停止接单、排空已接任务、等待结果和到期后取消剩余任务。
- 以单调 deadline 限制排空时间，并在超时后显式 abort、join 剩余 async task。
- 报告每个任务的成功、失败或取消终态；不把到 deadline 当成已自动停止。

## 先修

完成 M15-L01–L02，理解中间状态回滚、cooperative cleanup 与 abort 的区别。本节示例只管理当前进程 JoinSet 中的 task；外部数据库事务与分布式部署的 leader/shutdown 协议不在范围内。

## 停机有多个阶段

安全停机通常先停止接收新工作，再关闭 admission/channel，随后排空已接受的工作。给排空设置绝对 deadline，避免每次等待都重置预算。deadline 到达表示还没完成，不表示工作已被停止；调用方需要明确对剩余 Tokio async task 发 `abort_all()`，然后 `join_next()` 收集全部终态。同步阻塞代码若不 yield，deadline/abort 都不能抢占它。

```rust
let deadline = tokio::time::Instant::now() + grace_period;
let mut completed = Vec::new();
loop {
    match tokio::time::timeout_at(deadline, tasks.join_next()).await {
        Ok(Some(Ok(value))) => completed.push(value),
        Ok(Some(Err(join_error))) => report_task_error(join_error),
        Ok(None) => break,
        Err(_elapsed) => {
            tasks.abort_all();
            while let Some(result) = tasks.join_next().await {
                report_final_state(result);
            }
            break;
        }
    }
}
```

真实实现还要考虑 deadline 后的 cleanup/报告预算；若 cleanup 自身也可能无限挂起，就需要第二个边界或外部强制退出。`JoinSet` 被 drop 会 abort 仍跟踪的 task，但只 drop set 不能替代逐项观察它们的终态。

## deadline 与 timeout 的含义

`timeout_at(deadline, future)` 返回 `Elapsed` 时会 drop 这次等待的 future。若 inner future 是 `&mut JoinSet` 上的 `join_next()`，未完成的 set/task 仍在调用方持有，必须显式 `abort_all()` 或继续 drain。对一个 owned future 的 timeout 只保证 drop 该 future；它不会自动推断调用方要取消所有子 task。

使用一个绝对 deadline 统一 drain budget；不要循环重新计算“现在 + grace period”，否则每个任务都能延长总停机时间。通过事件 gate 控制任务完成，用 deadline 只作为实际停机策略，而不是测试 task 先后顺序的方法。

## 收集终态

`JoinSet::join_next` 提供已经结束的 task 结果；每项都要分成正常输出、panic/error 和 cancellation。正常 shutdown 目标是接受的新工作都有结果。deadline 结束时尚未开始或未完成的工作必须标成 cancelled/rejected，而不是和成功结果混在一起。若使用 cooperative token，先发信号并给清理一个 grace period，再对仍运行的剩余任务 abort。

## 分层提示

1. **阶段提示**：停止接单、排空、取消和退出分别发生在哪个边界？
2. **deadline 提示**：每次任务等待都延长 grace period 会有什么风险？
3. **timeout 提示**：`Elapsed` 取消的是 `join_next` 等待，还是整个 JoinSet 内任务？
4. **终态提示**：`abort_all()` 之后如何确认剩余 task 已结束并统计取消数？
5. **测试提示**：已完成任务通过 gate 先完成；deadline 情况用一个立即到期的绝对时点，检查 abort/join 终态。

## 来源

- [Tokio API：`JoinSet`](https://docs.rs/tokio/latest/tokio/task/struct.JoinSet.html)
- [Tokio API：`timeout_at`](https://docs.rs/tokio/latest/tokio/time/fn.timeout_at.html)
- [Tokio API：`JoinHandle::abort`](https://docs.rs/tokio/latest/tokio/task/struct.JoinHandle.html)

官方文档用于核对 JoinSet drop/abort/join 行为、timeout future drop 语义和 task abort 边界；停机流程与受控任务轨迹为原创。作者稿尚未通过正式 R2 与独立学习者验收。
