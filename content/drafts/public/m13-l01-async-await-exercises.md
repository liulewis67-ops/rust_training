# M13-L01 短练习：async/await 与惰性 Future

这三题对应“预测、修复、实现”。作答时区分函数调用时计算实参、Future 创建和 Future 被 poll；不要把 Future 误当成已启动的线程。

## 预测：函数体何时执行

预测以下代码每个断言处的 `events`，以及丢弃未 poll 的 Future 是否会写入事件。写出“调用 async 函数”和“执行函数体”的先后关系。

```rust
use std::cell::RefCell;
use std::rc::Rc;

async fn record(events: Rc<RefCell<Vec<&'static str>>>) {
    events.borrow_mut().push("body");
}

let events = Rc::new(RefCell::new(Vec::new()));
let future = record(Rc::clone(&events));
assert!(events.borrow().is_empty());
drop(future);
assert!(events.borrow().is_empty());
```

**公开契约**：说明 async 调用返回值的性质；准确预测两个断言；说明参数表达式是否仍在调用时求值。

**分层提示**：① 找出 `push` 所在的函数体。② 检查代码是否 poll 该 Future。③ 不要把 `drop` 解释成“等待运行”。

## 修复：await 不会在普通函数中启动工作

修复下面的编译错误，并解释外层如何取得 `u32` 结果。保持程序逻辑：async 计算完成后打印结果。

```rust,compile_fail
async fn calculate() -> u32 { 6 * 7 }

fn main() {
    let value = calculate().await;
    println!("{value}");
}
```

**公开契约**：代码应有合法的非 async `main`，结果必须在 Future 完成后打印；不可假装 Future 已经执行。

**分层提示**：① `.await` 只可写在 async context。② `main` 仍是普通函数。③ 由运行时提供的入口函数（或本节样例中的同步手动 poll）驱动 async block。

## 实现：观察一次 poll 的执行事件

补全 `record` 和 `poll_record`，让 `record` 在首次被 poll 时向共享事件列表追加 `"body"` 并完成；`poll_record` 返回 Future 的 `Poll::Ready` 或 `Poll::Pending`。用标准库 `Waker::noop` 与 `Context`，不得加入依赖或写忙循环。

```rust
use std::cell::RefCell;
use std::future::Future;
use std::pin::pin;
use std::rc::Rc;
use std::task::{Context, Poll, Waker};

async fn record(events: Rc<RefCell<Vec<&'static str>>>) {
    // TODO: 写入 body 事件
}

fn poll_record<F: Future<Output = ()>>(future: F) -> Poll<()> {
    // TODO: Pin 后只 poll 一次
    todo!()
}
```

**公开契约**：调用 `record` 后事件列表仍为空；poll 后为 `["body"]`；不得 poll 已完成 Future 第二次。

**分层提示**：① 先用 `pin!` 固定 Future。② `Context::from_waker(Waker::noop())` 创建本次 poll 的上下文。③ 用 `future.as_mut().poll(&mut context)` 返回原始 Poll 结果。

参考答案和评分规则保存在私有教师评测资料中；此公开题面不包含答案。
