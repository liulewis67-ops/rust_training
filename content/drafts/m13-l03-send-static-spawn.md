# M13-L03：`Send` / `'static` 与 spawn

## 学完后

- 解释 Tokio `spawn` 为什么要求 task Future 满足 `Send + 'static`，并区分这两个约束。
- 对局部借用、拥有的 String、跨 `.await` 存活的 `Rc` 分别预测编译结果。
- 通过 `async move`、重新设计所有权或让非 Send 局部值在 await 前结束作用域修复 task。
- 说明即使使用 current-thread runtime，`tokio::spawn` 也仍有其 API 的 Send 限制。

## 先修

完成 M13-L02，理解 task 由 runtime 调度而不等同 OS thread；完成 M12-L02，理解 `Send`、`Sync`、`Rc` 与 `Arc`。本节只讨论 Tokio `tokio::spawn` 的输入 future 边界，不讲 local task 集合或 join/cancel 的错误处理策略。

## `tokio::spawn` 要求什么

`tokio::spawn(future)` 把一个 Future 交给 runtime 调度，并返回 `JoinHandle<T>`。该 API 要求 `future: Future + Send + 'static`，且 `future::Output: Send + 'static`。这些是 Tokio spawn 的 API 契约；不要把它推广成每一种 executor 的通用要求。

- **`Send`**：值可安全地在线程边界间移动。多线程 runtime 在 task 暂停后可以将它交给另一 worker thread；因此 task 的状态也必须适合跨线程移动。
- **`'static` 类型边界**：Future 不含指向短生命周期栈变量的借用，使 runtime 不需要证明 task 会在某个外层作用域之前结束。它不是“这个值必须一直活到进程退出”，拥有的 `String` 即可满足 `'static`，即使 task 很快结束并 drop。

这两个约束回答不同问题：owned `Rc<String>` 没有外借生命周期问题，却不满足 Send；`&String` 可能满足 Send，却仍借用局部 owner 而不满足 `'static`。

## 移交所有权：move 能解决什么

默认 async block 会根据使用方式借用外部变量。spawn 可能令 task 晚于当前函数返回，因此这个借用不能悬空：

```rust,compile_fail
fn spawn_borrowed() {
    let label = String::from("batch-7");
    tokio::spawn(async {
        println!("{label}"); // Future 借用局部 label
    });
}
```

如果 task 应独立拥有该 String，将所有权 move 进 Future：

```rust
#[tokio::main(flavor = "current_thread")]
async fn main() {
    let label = String::from("batch-7");
    let task = tokio::spawn(async move {
        tokio::task::yield_now().await;
        label.len()
    });

    assert_eq!(task.await.expect("task should return a length"), 7);
}
```

`move` 改变捕获的所有权，不会改变捕获类型实现的 trait：`async move` 捕获 `Rc<T>` 后仍然含有 `Rc<T>`，不会自动变成 Send。若两个 task 确需共享数据，评估 `Arc<T>`；若数据不必跨 await 存活，可缩小它的作用域并在 await 前 drop。

## Send 取决于暂停时保留的状态

Future 会被编译成可在 await 处暂停和恢复的状态机。局部值如果在 `.await` 之后仍会使用，就必须保存在状态机里。如果 `Rc` 存活跨越该暂停点，spawn 所需的 Future 就不是 Send，编译失败：

```rust,compile_fail
fn spawn_rc_across_await() {
    tokio::spawn(async {
        let state = std::rc::Rc::new(String::from("local"));
        tokio::task::yield_now().await;
        println!("{state}"); // Rc 必须存进跨 await 状态，Future 不满足 Send
    });
}
```

如果 `Rc` 只用于暂停前的一段同步局部逻辑，并且在 `.await` 前离开作用域，spawn Future 可能仍是 Send：

```rust
tokio::spawn(async {
    {
        let state = std::rc::Rc::new("before await");
        println!("{state}");
    } // Rc 在暂停前销毁，不属于之后保存的 task 状态

    tokio::task::yield_now().await;
});
```

优先让数据的生命周期与实际需求匹配，而不是先 clone 任意大对象。确实需要多个 task 在等待后继续读共享状态时，再选择 Arc 或同步原语，并明确读写和锁范围。

## 不因 runtime flavor 忽略 API 边界

`tokio::spawn` 的 Send 约束不因测试选了 current-thread runtime 而取消；代码可能在其他 Tokio runtime 中重用，API 合约也固定如此。其他库可能提供单线程本地 task API，但那有不同的生命周期、局部调度与互操作边界，不属于本节的 `tokio::spawn`。

## 分层提示

1. **两类约束**：当前值是否带有短生命周期借用？若不是，它是否仍实现 Send？分别判断，不要把 `'static` 与“值永不销毁”混为一谈。
2. **move 提示**：检查 async block 捕获了什么类型。move 可以把 `Rc` 本身移入 block，但不能使这个类型实现 Send。
3. **await 提示**：把每个变量的最后一次使用标在 await 前后。跨暂停点仍需使用的变量会成为 Future 状态的一部分。
4. **作用域提示**：若 Rc 只用于 await 之前，把它放入更小的 block，让 drop 发生在暂停之前。
5. **共享提示**：调用方和 task 都需要同一所有数据时，先决定需要复制、移动还是跨 task 共享；只有最后一种通常需要 Arc。

## 来源

- [Tokio Tutorial：Spawning](https://tokio.rs/tokio/tutorial/spawning)
- [Tokio API：`tokio::spawn`](https://docs.rs/tokio/latest/tokio/task/fn.spawn.html)
- [Rust 标准库：`Send`](https://doc.rust-lang.org/std/marker/trait.Send.html)
- [The Rust Programming Language：Futures, Tasks, and Threads](https://doc.rust-lang.org/book/ch17-06-futures-tasks-threads.html)

官方资料用于核对 Tokio spawn trait bounds、`'static` 含义以及 await 状态和 Send 的联系；数据流情境与练习为原创。本作者稿尚未通过 R2 固定 Linux 环境和正式课程接入。
