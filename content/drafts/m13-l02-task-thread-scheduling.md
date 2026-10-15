# M13-L02：task、线程与调度

## 学完后

- 区分 Future、task 与 OS 线程各自代表的执行单位。
- 说明 executor/scheduler 如何推进 runtime 管理的 task，以及 `.await` 返回 Pending 后的协作切换。
- 从运行时 flavor 判断任务能否并行运行，以及多个 task 是否可能共用一个 OS 线程。
- 复现实验：在单线程 Tokio runtime 中执行同步阻塞调用，观察 sibling task 只能等阻塞返回后再推进。

## 先修

完成 M13-L01，能说明 Future 要被 poll 才推进；完成 M12-L01/L02，认识 OS 线程、`Send` 和共享边界。本节使用 Tokio 展示任务调度，不深入 spawn 的 `'static` 边界、取消和阻塞池，这些会在后续单元处理。

## 三种执行单位

- **Future** 描述一次可被推进的异步计算，可能组合成包含许多子 Future 的状态机。Future 本身不代表独立线程。
- **task** 是 runtime/executor 管理的一组异步工作。它持有要推进的 Future，并在等待时保存续跑状态。以 Tokio 为例，`tokio::spawn` 把 async block 交给 runtime，返回 task 的 `JoinHandle`。
- **OS thread** 是操作系统调度的执行流。runtime 有一个或多个 worker thread，由它们轮流 poll task。

一个 task 不是一条 OS 线程。单线程 runtime 中，很多 task 共用同一条 OS 线程，并通过暂停和恢复交替前进；多线程 runtime 可以把 task 放到不同 worker thread 上，任务也可能在等待后由另一 worker 继续。具体采用哪种方式由 runtime 配置与调度决定。不要仅凭 task id 推断 thread id，也不要假定一个 task 固定绑定一个 worker。

```rust
#[tokio::main(flavor = "current_thread")]
async fn main() {
    let handle = tokio::spawn(async {
        // 这是由 Tokio 调度的 task，不是显式创建的 OS thread。
        std::thread::current().id()
    });

    let task_thread = handle.await.expect("task should return its thread id");
    assert_eq!(task_thread, std::thread::current().id());
}
```

这个断言只适用于当前配置的 `current_thread` runtime。把 flavor 换成多线程 runtime 后，不应依赖 task 一定在哪一条 worker thread 上执行。

## 调度与协作切换

当 task 执行到一个未就绪的异步操作的 `.await`，它会返回 Pending，将控制权交还 executor；其他就绪 task 于是可以获得推进机会。底层 I/O 变为就绪后，Future 使用 Waker 通知 executor 重新调度对应 task。executor 选择后续要 poll 哪个 task。

调度不是抢占式地在每条 Rust 语句后切换。若 task 在一次 poll 中运行很久、不遇到会 Pending 的 await，也不主动让出执行权，那么同一 worker 上的其他 task 会等它返回控制权。即使程序用了 async 语法，poll 中同步阻塞也会占住 worker thread；单线程 runtime 上尤其容易让所有 sibling task 一同停滞。

### 可观察的阻塞调度实验

示例 crate 的确定性回归测试使用 current-thread runtime，并用两个零容量标准库 channel 与 watchdog 线程握手：

1. 当前 async test task 先 spawn 一个记录事件的 sibling task；它不会因 spawn 自动抢占当前 task。
2. 当前 task 发出 `blocking-start`，随后同步等待 watchdog 的 release 消息。此时它仍占着唯一 runtime thread。
3. watchdog 收到开始信号后立刻放行；在等待窗口内，sibling 尚未运行。开始信号使用零容量 channel，release 使用容量为 1 的 bounded channel；两侧接收都设定截止时间，故失败时不会无限挂住。
4. 同步等待返回后，当前 task 记录 `blocking-end`，再 await sibling handle。这个 await 让 executor 得以 poll sibling，最终事件序列为 `blocking-start`, `blocking-end`, `sibling`。

这里的外部 watchdog 只用于可靠解除实验中的同步等待，不表示 Tokio 在 runtime 外执行被阻塞的 task。测试断言的是受控单线程配置中的调度边界，不依赖 sleep、wall-clock 快慢或不同 task 的默认排队顺序。

生产代码不要用同步阻塞等待模拟异步 I/O。应使用异步 I/O Future；长时间同步/CPU 工作的隔离与并发限额留待 M13-L04。当前单元用实验展示为何这个边界重要。

## 不要从一个 runtime 推广所有运行时

Tokio 提供单线程和多线程 runtime flavor。current-thread runtime 适合观察 task 交替，不提供多核并行；multi-thread runtime 可以让不同 task 真正同时在多个 OS thread 上运行。其它 runtime 也可能采用不同 worker、局部队列与公平性策略。教材只依赖公开 API 契约，不把一次输出顺序当全局 scheduler 保证。

异步 task 与线程不是互斥选择：runtime 自身可以由多线程实现，应用也可以把 CPU 并行交给专用线程，再用异步任务管理 I/O。选择执行方式要看等待、计算、工作量上限和运行时配置，不能用“async 比 thread 轻”代替设计判断。

## 分层提示

1. **分类提示**：Future 保存一次计算状态；哪个组件负责重复 poll？task 和 OS thread 分别由谁管理？
2. **单线程提示**：current-thread runtime 的多个 task 共享哪一个执行资源？一个 task 尚未 yield 时 sibling 能否凭空抢占它？
3. **事件提示**：sibling spawn 后主 task 仍同步 recv。标记主 task 真正让出 runtime 的第一个位置。
4. **实验提示**：watchdog 看到 blocking-start 后立即发 release；零容量 channel 建立先后关系，timeout 只充当故障截止时间。
5. **泛化提示**：同线程结果是 `current_thread` 配置保证，不是 Tokio multi-thread 或所有 async runtime 的保证。

## 来源

- [The Rust Programming Language：Futures, Tasks, and Threads](https://doc.rust-lang.org/book/ch17-06-futures-tasks-threads.html)
- [The Rust Programming Language：Applying Concurrency with Async](https://doc.rust-lang.org/book/ch17-02-concurrency-with-async.html)
- [Tokio Tutorial：Overview](https://tokio.rs/tokio/tutorial)
- [Tokio Tutorial：Spawning](https://tokio.rs/tokio/tutorial/spawning)
- [Tokio API：`#[tokio::test]`](https://docs.rs/tokio/latest/tokio/attr.test.html)

官方资料用于核对 Future、task、OS thread 与 runtime scheduler 的关系以及 Tokio 测试配置；单线程阻塞实验、练习与观测事件为原创。此作者稿尚未通过 R2 固定 Linux 环境和正式课程门槛。
