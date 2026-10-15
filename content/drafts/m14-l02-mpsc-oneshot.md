# M14-L02：mpsc 与 oneshot channel

## 学完后

- 用 bounded `mpsc` 在多个生产者和一个消费者之间传递多条消息，并解释容量带来的 backpressure。
- 区分 channel 正常关闭、缓冲区排空和对端提前 drop。
- 用 `oneshot` 返回单个结果，并分别处理 send 失败与 receiver await 失败。
- 不吞掉 SendError、RecvError 或返回值中仍可恢复的数据。

## 先修

完成 M14-L01，能 await JoinHandle 并保留 task 的外层错误。本节通过 channel 表达任务间数据与完成通知；不讨论 select、队列服务级 admission 和 shutdown 协议。

## bounded mpsc：多发送者、单接收者

`tokio::sync::mpsc::channel(capacity)` 创建有界通道，容量必须大于零。Sender 可 clone，多处生产者把消息送入同一个单一 Receiver。消息按发送顺序可用；buffer 满时 `send(value).await` 等接收端腾出容量，这就是背压。

```rust
use tokio::sync::mpsc;

let (tx, mut rx) = mpsc::channel(2);
let other_tx = tx.clone();
tx.send("first").await.expect("receiver is alive");
other_tx.send("second").await.expect("receiver is alive");
drop(tx);
drop(other_tx);
assert_eq!(rx.recv().await, Some("first"));
assert_eq!(rx.recv().await, Some("second"));
assert_eq!(rx.recv().await, None); // 所有 Sender 都 drop 且缓冲已排空
```

Receiver 得到 `None` 表示通道已关闭且消息已排空；不能只因某一个 clone 被 drop 就断言通道关闭，仍存活的其他 Sender 还能发送。反过来，如果 Receiver 被 drop，后续 send 返回 `SendError<T>`，其中仍带着未送达的消息值。生产者应明确重试、回收或报告失败，不能只忽略错误。

容量限制的是缓冲消息数，不等同于系统总 admission、task 数或处理并发上限。若每条消息又无界 spawn 新任务，channel 只能限住队列这一处。

## oneshot：一个结果或一次通知

`oneshot::channel()` 创建一次性交付通道。Sender 只能发送一次；`send(value)` 是同步操作，不需要 `.await`，发送失败时返回原始 value。Receiver 可 `.await`；如果发送端在成功发送前 drop，结果是 `RecvError`。

```rust
let (reply_tx, reply_rx) = tokio::sync::oneshot::channel();
let _ = reply_tx.send(42_u32);
assert!(matches!(reply_rx.await, Ok(42)));
```

把 oneshot 用作 request/reply、单次完成通知或小型 task 结果传递时，仍要规定谁拥有 Sender、Sender 不发值退出时如何反馈、Receiver 已离开时结果值是否需要回收。Tokio `JoinHandle` 本身用于 join 一个 task；oneshot 是显式的消息通道，不应为了替代 JoinHandle 而丢掉 task panic/cancellation 状态。

## 失败方向

| 事件 | 可观测结果 | 调用方需要决定 |
|---|---|---|
| 所有 mpsc Sender drop，队列排空 | `recv().await == None` | 正常结束消费循环 |
| mpsc Receiver drop | `send(value).await == Err(SendError(value))` | 回收值、返回错误或按策略重试 |
| oneshot Sender 成功送出 | `receiver.await == Ok(value)` | 使用单次结果 |
| oneshot Sender 未发送就 drop | `receiver.await == Err(RecvError)` | 报告生产者未交付，不能造默认成功值 |
| oneshot Receiver drop | `sender.send(value) == Err(value)` | 明确丢弃或回收尚未交付的值 |

错误对象代表连接两端的生命周期事件，并不自动说明是业务失败还是平台故障。把这一区别保留到调用边界，才能给出可靠反馈。

## 分层提示

1. **容量提示**：mpsc buffer 满时，异步 send 会怎样？这限制的是哪类资源？
2. **关闭提示**：克隆的 Sender 还活着时，drop 一个 sender 会关闭整条通道吗？
3. **方向提示**：谁 drop 导致 send 失败，谁 drop 导致 receive 失败？
4. **数据提示**：SendError 内还保存了什么？接收端先退出时要怎样处理？
5. **次数提示**：oneshot 的 Sender 何时发送、send 本身是否 async、drop sender 后 receiver await 得到什么？

## 来源

- [Tokio API：bounded `mpsc::channel`](https://docs.rs/tokio/latest/tokio/sync/mpsc/fn.channel.html)
- [Tokio API：`oneshot::channel`](https://docs.rs/tokio/latest/tokio/sync/oneshot/fn.channel.html)
- [Tokio API：`mpsc::Sender::send`](https://docs.rs/tokio/latest/tokio/sync/mpsc/struct.Sender.html#method.send)
- [Tokio API：`oneshot::Sender::send`](https://docs.rs/tokio/latest/tokio/sync/oneshot/struct.Sender.html#method.send)

官方文档用于核对容量、背压、关闭与错误返回；场景、表格和练习为原创。作者稿尚未通过路线图要求的固定 R2 环境和正式课程验收。
