# M13-L01：`async` / `await` 与惰性 Future

## 学完后

- 说明调用 `async fn` 会得到一个实现 `Future` 的值，而不是立即执行函数体。
- 通过对照事件，区分创建 Future、poll Future 和 await Future。
- 说明 `.await` 是可能让出控制权的等待点；它不创建线程，也不保证并行。
- 认识本节示例只手动 poll 一个立即完成的 Future；真实异步 I/O 需要 executor/runtime 驱动。

## 先修

完成 M09 与 M12 的错误边界、所有权和线程基础。知道函数调用、闭包捕获与 `Result` 的基本语法。本节不要求 Tokio，不讨论 task spawn、调度器、取消或异步锁。

## 普通函数与 async 函数

普通函数在调用时执行函数体：

```rust
fn record(events: &mut Vec<&'static str>) {
    events.push("body");
}

let mut events = Vec::new();
record(&mut events);
assert_eq!(events, ["body"]);
```

`async fn` 调用会构造一个表示后续工作的 Future。调用时会先计算实参表达式，但函数体语句要等 Future 被 poll 才开始执行：

```rust
use std::cell::RefCell;
use std::rc::Rc;

async fn record_async(events: Rc<RefCell<Vec<&'static str>>>) {
    events.borrow_mut().push("body");
}

let events = Rc::new(RefCell::new(Vec::new()));
let future = record_async(Rc::clone(&events));
assert!(events.borrow().is_empty()); // 只创建了 Future
drop(future);                       // 丢弃未 poll 的 Future，不会执行函数体
assert!(events.borrow().is_empty());
```

调用表达式中的实参仍会照常求值。惰性描述的是 async 函数体的推进，不是把整个调用表达式冻结起来。

## `Future`、poll 与 `await`

`Future` 用关联类型 `Output` 描述完成时产出的值。executor 通过 `poll` 推进它：`Poll::Ready(value)` 表示完成，`Poll::Pending` 表示暂时无法继续，并由 Future 通过 `Context` 中的 Waker 通知执行器何时再试。调用方不应忙循环反复 poll。

在 async 函数或 async block 内，`future.await` 会把被等待的 Future 纳入当前状态机并尝试推进它。遇到 `Pending` 时，当前 async 计算可以让出控制权，等唤醒后继续；因此 `.await` 是潜在暂停点。await 的语法不是“阻塞当前线程直到完成”的承诺，也不是“另开线程”的语法。

本节样例用标准库的 `Waker::noop` 对一个立即 Ready 的 Future 手动 poll 一次，只展示惰性边界，不实现 executor。生产代码应由选定 runtime 的 executor 管理 poll 与唤醒。

```rust
use std::future::Future;
use std::pin::pin;
use std::task::{Context, Poll, Waker};

let mut future = pin!(async { 21 * 2 });
let mut context = Context::from_waker(Waker::noop());
assert!(matches!(future.as_mut().poll(&mut context), Poll::Ready(42)));
```

Future 完成后不要再 poll；`Future` trait 不保证完成后重复 poll 的行为。

## async block 与顺序

`async { ... }` 和 `async move { ... }` 也会创建 Future。只创建多个 Future 不等于它们已经开始：

```rust
let first = async { "first" };
let second = async { "second" };
// 此时只是持有两个 Future；没有创建线程，也没有证明并行执行。
```

若在同一个 async block 里依次 `await`，程序按代码顺序等待每个结果。想让多个 I/O 操作重叠，需要后续学习由 runtime 驱动的任务或组合器；这不是给表达式加上 `async` 就自动得到的。

## 选择边界

异步适合大量等待外部进展、且可以在等待时让执行器推进其他工作负载的任务，例如 socket 可读等待。CPU 密集计算不会因为包装成 Future 就自动分摊到多个核心。轮询实现应快速返回，不应在 `poll` 中做长时间阻塞工作。

## 分层提示

1. **时序提示**：先标出普通函数调用、async 函数调用、Future 的第一次 poll 三个事件。函数体中的第一条语句属于哪一步？
2. **类型提示**：`async fn f() -> u32` 的签名表面上写了 `u32`，但调用 `f()` 得到的值实现了什么 trait？
3. **await 提示**：`await` 只能写在 async 函数或 block 中。当前 Future 若返回 `Pending`，谁负责稍后再次 poll？
4. **并发提示**：Future 是描述可推进计算的值。单有多个 Future，是否已有任何 executor 在 poll 它们？
5. **边界提示**：区分“让当前任务在等待时让出执行权”和“把 CPU 工作移到另一个 OS 线程”。

## 来源

- [The Rust Programming Language：Futures and the Async Syntax](https://doc.rust-lang.org/book/ch17-01-futures-and-syntax.html)
- [Rust 标准库：`Future`](https://doc.rust-lang.org/std/future/trait.Future.html)
- [Rust 标准库：`Waker::noop`](https://doc.rust-lang.org/std/task/struct.Waker.html#method.noop)

官方资料用于核对惰性、Future 的 poll/唤醒契约和 await 的暂停边界；教学情境、对照和练习为原创。本作者稿尚未通过路线图要求的 R2 固定 Linux 环境与正式课程接入。
