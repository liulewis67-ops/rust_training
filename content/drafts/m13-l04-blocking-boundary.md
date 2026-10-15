# M13-L04：阻塞边界、`spawn_blocking` 与并发上限

## 学完后

- 识别 Tokio task 中会阻塞 worker 的同步 I/O 与长时间不 yield 的计算。
- 将有限且最终会结束的同步工作移入 `spawn_blocking`，并收集结果。
- 在调用 `spawn_blocking` 之前申请共享 Semaphore permit，限制同时进入 blocking pool 的工作数。
- 将 permit 的所有权交给 blocking closure，避免外层 Future 被 drop 后过早释放并发额度。
- 验证一批 blocking 操作在固定上限内分波完成，不用 sleep 或耗时阈值判断。

## 先修

完成 M13-L03，理解 spawn Future 的 `Send + 'static` 边界和 move 所有权；完成 M13-L02，区分 Tokio worker、task 与 blocking pool thread。本节使用 Tokio Semaphore 和 `spawn_blocking`；不覆盖 long-lived worker 的退出协议、P2 任务取消或 runtime shutdown policy。

## 为什么同步阻塞会占住 worker

一个 async task 在一次 poll 中调用 `std::fs` 阻塞接口、同步 socket API、`std::thread::sleep` 或长时间 CPU 循环时，当前 Tokio worker thread 必须等调用返回。其它 async task 不能在这条 worker 上得到 poll 机会。短小且确定为常数时间的同步计算通常不需要另开线程；有限的阻塞 I/O 或无法拆分的长计算则应明确移出 async worker。

## `spawn_blocking` 提供边界，不等于业务并发上限

`tokio::task::spawn_blocking` 把 `FnOnce` 闭包交给适合执行阻塞工作的 thread pool，完成后可 await `JoinHandle` 获取返回值。它适合最终会完成的阻塞调用。开始运行后的 closure 不能由 `JoinHandle::abort` 强制终止；如果工作可能长期不结束，专用 thread/worker 通常更适合。

Tokio 会按需扩大 blocking pool，直到 runtime 配置的线程上限，之后在 pool 内排队。这个上限通常是较大的通用线程预算，不能替代应用的 CPU/外部资源并发预算。大量 CPU 工作应使用 Semaphore 等限制同时在途的 blocking closure；可拆分的纯 CPU 并行工作也可考虑 Rayon。

## 两个步骤才能真正限制 blocking 工作

先在 async 边界取得**同一共享 Semaphore** 的 owned permit，再创建 blocking closure：

```rust
use std::sync::Arc;
use tokio::sync::Semaphore;

async fn parse_limited(input: String, capacity: Arc<Semaphore>) -> String {
    let permit = Arc::clone(&capacity)
        .acquire_owned()
        .await
        .expect("capacity stays open while accepted work drains");

    tokio::task::spawn_blocking(move || {
        // Permit follows the blocking operation, not its async waiter.
        let _permit = permit;
        parse_with_sync_library(input)
    })
    .await
    .expect("blocking parser should return a result")
}
```

多个请求必须共享调用方传入的同一个 `Arc<Semaphore>`，不能每次调用都 new 一个 Semaphore。只在 blocking closure 内申请 permit 会先把大量阻塞 closure 提交给 pool，线程/队列已经产生后才限流；这没有封住 `spawn_blocking` 的入口。

`acquire_owned` 产生可 move 进 closure 的 permit。permit 在 closure 返回或 unwind 时 drop。若 permit 只保存在 async caller，caller 被取消或丢弃 JoinHandle 后它可能先释放，而已经开始的 blocking closure 仍会继续跑，之后的工作便能超出预算。把 permit 交给 closure 能让并发额度跟着实际资源占用持续到操作结束。

每个 blocking closure 都必须有界并最终结束；Semaphore 只能限制并发数，不能让无限阻塞或不可取消的任务变安全。长期任务用专用线程或受控进程边界；需主动停止的计算要在工作代码里定期检查取消信号。

## 可重复的波次实验

私有参考样例提交 4 个工作项、并发容量 2。每个 closure 更新 active/peak 计数后阻塞在自己的 release channel。测试逐批观察两个 `started` 事件，断言 active 正好为 2，再放行这一批；permit 释放后下一批才会进入。四项都完成后检查峰值为 2、结果齐全且 active 回到 0。

每个 release 接收都有明确 deadline，避免错误样例永久挂起；正常路径由通道握手排序，没有固定 sleep、wall-clock 性能断言或依赖 OS 调度运气。blocking 池最多只会有当前持 permit 的两项进入本实验。

## 分层提示

1. **阻塞提示**：async 函数里的同步调用依旧是同步调用；谁会等待它返回？
2. **入口提示**：Semaphore 应位于创建 blocking closure 前，还是已进入 pool 以后？
3. **所有权提示**：若调用 task 被 drop，谁还持有 permit？把 owned permit 移进哪一侧能匹配实际工作寿命？
4. **限额提示**：所有请求须引用同一个计数器；在每批工作未 release 时观察 active 与 peak。
5. **取消提示**：对已启动的 `spawn_blocking` 调用 abort 不能结束同步代码。permit 在 closure 退出前仍需占用。
6. **边界提示**：短期有限工作交给 spawn_blocking；长期工作使用明确生命周期的 thread/worker；无限提交还需上游队列/接纳策略。

## 来源

- [Tokio API：`spawn_blocking`](https://docs.rs/tokio/latest/tokio/task/fn.spawn_blocking.html)
- [Tokio API：`Semaphore`](https://docs.rs/tokio/latest/tokio/sync/struct.Semaphore.html)
- [Tokio Topics：Bridging with sync code](https://tokio.rs/tokio/topics/bridging)

官方资料用于核对 blocking pool 的用途、并发限制和 abort 边界；共享额度的实验契约与题面为原创。本作者稿尚未通过 R2 固定 Linux 环境和正式课程接入。
