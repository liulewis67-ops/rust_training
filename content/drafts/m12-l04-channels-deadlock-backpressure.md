# M12-L04：channel、锁顺序与有界队列

## 学完后

- 用 channel 传递 owned message，解释 Sender/Receiver 的所有权和断开错误。
- 区分无界 `channel` 与 `sync_channel`：后者限制缓冲容量，满时 `send` 会等待。
- 设计生产者/消费者的关闭和错误传播，使接收端持续排空队列。
- 找出相反顺序取得多把锁的循环等待，并规定稳定的全局加锁顺序。
- 用 `try_send` 和 `try_lock` 稳定观察压力与冲突，不靠 sleep 或把死锁当作唯一检查。

## 先修

完成 M12-L03，理解 guard 的持有范围；完成 M12-L01/L02，理解线程所有权、Send 与 join。本节使用标准库 `std::sync::mpsc` 和 `Mutex`，不引入 async channel、超时策略或第三方运行时。

## Channel 传递所有权

标准库 mpsc channel 有一个 Receiver 和可 clone 的发送端。`send(value)` 将 value 的所有权交给队列；成功后发送者不能继续使用该值。Receiver 收到后成为新 owner。发送端被全部 drop 后，等待中的 `recv` 返回 `RecvError`；接收端先关闭时，`send` 返回 `SendError<T>` 并把未发送的 T 带回来。把错误作为正常关闭协议处理，不用 `unwrap` 掩盖对端提前退出。

```rust
use std::sync::mpsc::channel;
use std::thread;

let (sender, receiver) = channel();
let worker = thread::spawn(move || {
    sender.send(String::from("finished")).expect("receiver is alive");
});

assert_eq!(receiver.recv().expect("sender is alive"), "finished");
worker.join().expect("worker should finish");
```

无界 `channel` 的 send 不会因缓冲区容量等待，但慢消费者可能让待处理消息不断增加。它适合消息速率与内存预算可接受的场景，不自带背压。

## 有界 channel 提供背压

`sync_channel(capacity)` 使用固定容量缓冲区。缓冲区满时，阻塞式 `send` 等待空间；容量为 0 时是 rendezvous channel，send 要等到 receiver 配对接收。Receiver 仍是单消费者；多个 producer 可 clone SyncSender。

下面的检查不靠调度时间：容量为 1 时放入一条消息后，第二次 `try_send` 必须返回 `Full(value)`。收到第一条消息后，原样重试被退回的值便能成功：

```rust
use std::sync::mpsc::{TrySendError, sync_channel};

let (sender, receiver) = sync_channel(1);
sender.try_send("first").expect("one slot is empty");
let pending = match sender.try_send("second") {
    Err(TrySendError::Full(value)) => value,
    other => panic!("expected a full queue, got {other:?}"),
};
assert_eq!(receiver.recv().unwrap(), "first");
sender.try_send(pending).expect("receiving freed a slot");
assert_eq!(receiver.recv().unwrap(), "second");
```

生产者和消费者必须共同设计关闭流程：消费者退出时 drop Receiver 会让后续 send 失败；生产者退出并 drop 所有 sender 后，receiver 才能观察到队列结束。若 producer 持续发送而消费者停止读取，满队列上的阻塞 send 会让 producer 等待；不要在持有其它必需锁时阻塞 send，否则消费者可能需要同一把锁才能推进并取走消息。

## 两把锁要使用固定顺序

单把 Mutex 避免同时写共享值，但多个锁如果被不同路径按相反顺序取得，就可能形成环：线程 A 持有 left 并等 right，线程 B 持有 right 并等 left。真正调用两个阻塞 lock 来演示会让课程或测试挂住，所以用屏障先让双方各持一把锁，再以 `try_lock` 观察对侧忙碌。这个检查稳定呈现冲突，不依赖谁先运行：

```rust
use std::sync::{Arc, Barrier, Mutex, TryLockError};
use std::thread;

let left = Arc::new(Mutex::new(()));
let right = Arc::new(Mutex::new(()));
let ready = Arc::new(Barrier::new(2));

let left_first = {
    let (left, right, ready) = (Arc::clone(&left), Arc::clone(&right), Arc::clone(&ready));
    thread::spawn(move || {
        let _left = left.lock().unwrap();
        ready.wait();
        matches!(right.try_lock(), Err(TryLockError::WouldBlock))
    })
};
let right_first = {
    let (left, right, ready) = (Arc::clone(&left), Arc::clone(&right), Arc::clone(&ready));
    thread::spawn(move || {
        let _right = right.lock().unwrap();
        ready.wait();
        matches!(left.try_lock(), Err(TryLockError::WouldBlock))
    })
};

assert!(left_first.join().unwrap());
assert!(right_first.join().unwrap());
```

修复是让所有需要同时取得两把锁的路径遵守同一顺序，例如总是 left 再 right；不能让调用者任选顺序。只需单独操作一把锁时不要额外取得另一把。持有锁时避免等待 channel、join worker、做 I/O 或调用未知回调。

样例包使用一个 `add_pair_in_order` 函数把顺序固定为 left→right；竞争测试从屏障后同时进入这一路径，并断言两边的更新总量。另一项 try-lock 对照只观察反向持锁会阻止第二步，并让 guard 自然 drop，测试不会构造真实死锁。

## 分层提示

1. **所有权提示**：`send` 成功后值已经移动；接收端结束时要检查 send/recv 的 Result。
2. **容量提示**：capacity 是允许排队的待处理消息数；try_send 的 Full 会把尚未发送的值返回。
3. **关闭提示**：sender 全部 drop 才会结束接收循环；receiver drop 会通知 producer send 失败。
4. **锁顺序提示**：画出每个锁等待箭头。相反顺序能形成环；为所有路径选一个共同顺序。
5. **避免挂起提示**：用 barrier 建立同时持锁状态，再 try_lock/try_send 检查边界；不以 sleep 或阻塞死锁作为唯一证据。

## 来源

- [Rust Book：线程间消息传递](https://doc.rust-lang.org/book/ch16-02-message-passing.html)
- [Rust 标准库：`std::sync::mpsc`](https://doc.rust-lang.org/std/sync/mpsc/)
- [Rust 标准库：`sync_channel`](https://doc.rust-lang.org/std/sync/mpsc/fn.sync_channel.html)
- [Rust 标准库：`SyncSender<T>`](https://doc.rust-lang.org/std/sync/mpsc/struct.SyncSender.html)
- [Rust 标准库：`Mutex<T>`](https://doc.rust-lang.org/std/sync/struct.Mutex.html)

官方资料用于核对消息所有权、断开结果、固定缓冲区和满队列行为、Mutex guard 与重入边界；生产者消费者和锁顺序场景为原创。
