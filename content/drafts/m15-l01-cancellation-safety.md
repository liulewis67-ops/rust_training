# M15-L01：取消安全与中间状态

## 学完后

- 说明 `select!` 中落选分支 future 会被 drop；future 被 drop 不会撤销已经发生的外部副作用。
- 区分“取消一次等待”和“请求停止 task”；对 `&mut JoinHandle` 等待具有 cancel-safe 输出保留语义。
- 为跨 await 的多阶段操作定义合法状态与回滚/提交边界，避免取消后留在半完成状态。

## 先修

完成 M14-L01–L06，理解 handle 结果、select、deadline 与 gate。取消协作信号、abort 和 service shutdown 的完整策略在 M15-L02/L03 继续。本节先判断 future drop 对状态机的影响。

## select 会 drop 落选分支

`tokio::select!` 在当前 task 轮询多个分支，首个匹配分支执行 handler，其余 branch future 被 drop。这个动作停止了那条 future 后续 poll，却不能回滚已经完成的数据库写、消息发送或其它外部副作用。每个可跨取消点的操作都要定义：当前处于哪个状态、重试是否幂等、清理由谁执行。

```rust
let outcome = tokio::select! {
    result = write_record(record) => Outcome::Written(result),
    _ = cancel_rx => Outcome::Cancelled,
};
```

若 `write_record` 已先写入一半，再 await 网络确认，`cancel_rx` 分支胜出只会 drop 剩余 future；数据库中间结果并不会自动消失。不要把 Rust future 的析构等同于事务 rollback。

## 状态边界要能恢复

把多阶段工作建模成 `Idle -> Prepared -> Committed`，并定义取消时 `Prepared -> RolledBack` 或安全重试的路径。一个常见做法是在 await 前建立同步 RAII guard；future 被 drop 时 guard 的析构回滚本地状态。guard 不能跨越 await 持有标准互斥锁，也不能声称撤销不可逆的远端副作用。外部系统需要事务、幂等键、补偿操作或可查询的提交确认。

本节 sample 用原子状态表示演练状态：成功路径到 Committed；gate 被关闭、future 被取消时必须到 RolledBack；绝不允许停在 Prepared。真实系统的回滚需要由业务协议承担。

## 取消等待与取消 task 是两件事

`JoinHandle` 的 `&mut` await 可以作为 `select!` 分支；若取消通知先到，等待分支被 drop，但 JoinHandle 仍在调用方手中，任务输出没有丢失。之后仍可释放 gate 并 join 原句柄。若要中止 Tokio async task，需显式调用 `abort()` 并随后 await/检查 `JoinError`；drop JoinHandle 则 detach task。`spawn_blocking` 已运行的 closure 不可由 abort 抢占。

```rust
let outcome = tokio::select! {
    result = &mut handle => WaitOutcome::Finished(result),
    _ = cancel_rx => WaitOutcome::WaitCancelled,
};
// WaitCancelled 只代表调用方停止本轮等待，handle 仍可 await。
```

## 分层提示

1. **future 提示**：select 另一个分支胜出后，落选 future 会不会再 poll？此前的 I/O 副作用会怎样？
2. **状态提示**：若 cancel 到达时操作处于 Prepared，合法的最终状态有哪些？
3. **guard 提示**：Rust drop 能自动回滚哪些本地状态？它不能撤销哪些远端副作用？
4. **handle 提示**：被 select 取消的是 owned handle 还是 `&mut handle` 等待？调用者还有没有结果路径？
5. **验证提示**：先打开 prepare gate，再 drop 操作 future，检查状态不能停在中间值。

## 来源

- [Tokio macro：`select!`](https://docs.rs/tokio/latest/tokio/macro.select.html)
- [Tokio API：`JoinHandle` cancel safety 与 abort](https://docs.rs/tokio/latest/tokio/task/struct.JoinHandle.html)

官方语义用于核对分支 drop、`&mut JoinHandle` cancel safety、abort 边界；状态机与 gate 演练为原创。作者稿尚未通过正式 R2 与独立学习者验收。
