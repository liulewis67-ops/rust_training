# M14-L04：Semaphore、队列与背压

## 学完后

- 用共享 Semaphore 限制同时执行的工作数，并把 permit 的存活范围覆盖整个受限操作。
- 用 bounded `mpsc` 限制等待区长度；说明满队列时是等待、拒绝还是回收输入。
- 组合队列容量与活动 permit 预算，避免在 semaphore 前创建无限等待 task。

## 先修

完成 M14-L01–L03，能收集 task 结果、用 channel 表达 gate 并理解 timeout 与 task 生命周期。本节只设计单进程队列和并发预算，不定义分布式限流、全局 shutdown 或重试策略。

## 两种上限管不同资源

Semaphore 的 permit 数限制某段工作的同时执行数。调用方必须共享同一个 `Arc<Semaphore>`；若每个请求都创建新的 Semaphore，预算就不再是全局预算。permit 要覆盖实际受限区间：提前 drop 会放行超额工作，忘记 drop 则会永久占着容量。正常离开作用域、返回错误或取消持有 permit 的 task 时，RAII 会释放 permit。

```rust
use std::{future::Future, sync::Arc};
use tokio::sync::{AcquireError, Semaphore};

/// Runs one job while holding a shared concurrency permit.
///
/// The closure is called only after a permit is acquired, so it can construct
/// work lazily instead of creating the operation before admission.
pub async fn run_limited<T, F, Fut>(
    permits: Arc<Semaphore>,
    job: F,
) -> Result<T, AcquireError>
where
    F: FnOnce() -> Fut,
    Fut: Future<Output = T>,
{
    let permit = permits.acquire_owned().await?;
    // Invoke the closure after admission and keep the permit through the await.
    let output = job().await;
    drop(permit);
    Ok(output)
}
```

`run_limited` 展示活动并发预算，但如果对每个外部请求先 `spawn` 一个等待 permit 的 task，等待 task 本身仍可能无界增长。Semaphore 不限制等待者数量。

## 有界队列承接等待工作

用 `mpsc::channel(capacity)` 建立有界等待区。消费者逐条接收，再在活动处理时获取 Semaphore permit。队列满时，异步 `send(value).await` 会施加背压；如果当前入口不能等待，可用 `try_send(value)` 明确拒绝或暂存返回的原值。队列容量只限制 buffer 中的消息数，不自动限制发送方预先创建的 task、正在执行的工作或其他副本。

```rust
use tokio::sync::mpsc;

let (tx, mut rx) = mpsc::channel(8);
// Producers await capacity, or choose a documented reject/recovery policy.
tx.send(job).await?;
while let Some(job) = rx.recv().await {
    // A fixed worker set can call run_limited before processing each item.
    process(job).await;
}
```

若有 `W` 个固定消费者、Semaphore 上限为 `C`、队列容量为 `Q`，应明确它们怎样组合；若消费者数与 semaphore waiter 都固定且处理前无额外 spawn，在途工作可按 `Q + min(W, C)` 估算。多个 producer 的积压、请求端缓存和正在传输的数据仍需单独计入系统预算。

## 过载决策

| 策略 | 满队列时 | 需要保留的契约 |
|---|---|---|
| 等待 | `send(value).await` 等容量 | 调用方必须能承受等待和取消语义 |
| 拒绝 | `try_send(value)` 返回 Full | 显式反馈 overload，并决定返回的原值如何处置 |
| 限时等待 | 有界等待后回传失败 | deadline、错误类型和未交付输入都清楚 |

不要只设置 Semaphore 然后无界 spawn 一堆等待它的 task；也不要吞掉 `TrySendError::Full(value)` 里的任务数据。shutdown 时关闭接收端会让未接收任务需要显式 drain 或回收，不能把丢弃误报成完成。

## 分层提示

1. **资源提示**：Semaphore 限制的是活动工作还是队列长度？`mpsc` 的容量又限制什么？
2. **共享提示**：多个请求若各自 new 一个 Semaphore，能否保证总并发预算？
3. **作用域提示**：permit 在 await 之前 drop 或 task 取消后分别有什么后果？
4. **过载提示**：满队列时应等待还是拒绝？选择 `send` 或 `try_send` 后如何处理原值？
5. **组合提示**：固定 worker 数、队列容量与 permit 上限分别入哪个内存/并发预算？

## 来源

- [Tokio API：`Semaphore`](https://docs.rs/tokio/latest/tokio/sync/struct.Semaphore.html)
- [Tokio API：bounded `mpsc::channel`](https://docs.rs/tokio/latest/tokio/sync/mpsc/fn.channel.html)
- [Tokio API：`mpsc::Sender::send` 与 `try_send`](https://docs.rs/tokio/latest/tokio/sync/mpsc/struct.Sender.html)

官方文档用于核对 permit 获取/归还、共享并发预算和有界队列满时的发送结果；本文的容量组合与场景为原创教学说明。作者稿尚未通过正式 R2 与独立学习者验收。
