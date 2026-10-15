# M11-L02：`Rc<T>` / `Arc<T>` 与共享所有权

## 学完后

- 用引用计数让多个拥有者共同持有同一份堆分配数据。
- 解释 clone 一个 `Rc` / `Arc` 是复制拥有句柄并更新计数，不是深拷贝 `T`。
- 观察强计数随 clone/drop 改变，并说明最后一个强拥有者释放时才销毁被拥有的值。
- 单线程共享选择 `Rc<T>`；需要跨线程共享时选择满足线程约束的 `Arc<T>`。
- 说明原子计数只保护 Arc 的共享拥有机制，不会自动让任意内部 `T` 线程安全。

## 先修

完成 M11-L01，能判断 Box 表达单一所有权和递归大小间接层；完成 M07-L01/L02 的 trait bound 基础，认识 `Send` 与 `Sync`。本节讨论共享所有权，不引入 `RefCell`、Mutex 或 Weak 的细节；内部可变性与环的处理分别在后续课讲解。

## 多个拥有者，而不是多个借用

普通引用 `&T` 临时借用一个由别处拥有的值；它本身不决定值何时销毁。`Rc<T>` 与 `Arc<T>` 则拥有堆上的同一份 `T`：每个克隆句柄都是一个强拥有者。调用 `Rc::clone(&rc)` 或 `Arc::clone(&arc)` 会创建指向同一分配的新句柄并增加共享计数，不要求 `T: Clone`，也不复制整个 `T`。

```rust
use std::rc::Rc;

let name = Rc::new(String::from("workspace-policy"));
let first_user = Rc::clone(&name);
let second_user = Rc::clone(&name);
assert!(Rc::ptr_eq(&first_user, &second_user));
assert_eq!(Rc::strong_count(&name), 3);
drop(first_user);
assert_eq!(Rc::strong_count(&name), 2);
```

名字 `clone` 容易让人误以为 `String` 被深复制；这里复制的是共享拥有句柄。若底层类型自己实现 Clone 且显式执行 `(**rc).clone()`，那才会复制 `T`。

当强计数回到零时，`T` 被 drop 一次，堆分配也随之释放。这个规则说明何时能安全销毁共享值；它不等于使用 `Rc` 可以自动打破拥有环。强引用环会让计数无法归零，`Weak` 会在后续章节处理这种关系。

## `Rc<T>` 和 `Arc<T>` 的线程边界

`Rc<T>` 用普通的非原子计数，适用于一个线程内的共享拥有。它不能被发送到其他线程，也不实现 `Send`。这避免为单线程用途支付原子操作成本。

`Arc<T>` 用原子操作维护多线程中的共享拥有计数。若多个线程需要读取同一份只读配置，可以克隆 Arc，并将句柄 move 给工作线程：

```rust
use std::sync::Arc;
use std::thread;

let labels = Arc::new(vec![String::from("compile"), String::from("test")]);
let worker_labels = Arc::clone(&labels);
let worker = thread::spawn(move || worker_labels[0].len());
assert_eq!(worker.join().expect("worker should finish"), 7);
assert_eq!(labels[1], "test");
```

`Arc<T>` 只有在 `T: Send + Sync` 时才能满足相应的跨线程 `Send` / `Sync` 约束。原子计数保证多个 Arc 句柄可以线程安全地共享和释放同一拥有分配；它不会替内部数据增加同步能力。比如 `Arc<RefCell<T>>` 仍不可跨线程共享，因为 RefCell 的运行时借用状态不是线程安全的。若确实需要共享可变状态，要选择 `Mutex<T>`、`RwLock<T>` 或原子类型，并明确锁范围与更新规则；不要把它误认为 Arc 自带。

## 按真实共享边界选择

| 情况 | 表达方式 | 为什么 |
|---|---|---|
| 单一拥有者，只需临时传引用 | `T` 与 `&T` | 生命周期由拥有者控制，不需要计数 |
| 多个单线程组件共同拥有只读数据 | `Rc<T>` | 强计数表示共同生命周期，不跨线程 |
| 多个线程共同拥有可安全共享的 `T` | `Arc<T>` | 原子计数支持不同线程持有句柄，且要求 `T` 满足 Send/Sync |
| 多线程共享且要变更同一状态 | `Arc<Mutex<T>>` 等 | Arc 只共享拥有；锁/原子另行提供同步规则 |

若只是把 `&T` 传给一个短时调用方，引用更直接。若进程中只有一个线程，Arc 虽然可用，却为不需要的跨线程能力支付原子计数成本。若只有一个拥有者，Box 或直接拥有的 `T` 通常足够。共享所有权要反映真实对象关系，不应成为默认包装。

## 分层提示

1. **计数提示**：每个 `Rc::clone` / `Arc::clone` 产生新拥有句柄；drop 哪个变量会使强计数减一？最后一个所有者何时退出？
2. **复制提示**：比较 `Rc::clone(&shared)` 与 `(*shared).clone()`；哪个复制句柄，哪个要求 `T: Clone` 并复制数据？
3. **线程提示**：共享是否真的跨线程？单线程 Rc 非 Send；Arc 的原子计数不能把非 Send/Sync 的内部类型变安全。
4. **可变性提示**：多个线程需要变更值时，谁负责序列化访问？先决定锁或原子策略，再将其放在 Arc 内。
5. **生命周期提示**：多个 owner 都退出后还有谁持有强计数？若一直不归零，后续 M11-L04 会分析强引用环。

## 来源

- [The Rust Programming Language：`Rc<T>`](https://doc.rust-lang.org/book/ch15-04-rc.html)
- [The Rust Programming Language：Shared-State Concurrency 与 `Arc<T>`](https://doc.rust-lang.org/book/ch16-03-shared-state.html)
- [Rust 标准库：`std::rc`](https://doc.rust-lang.org/std/rc/)
- [Rust 标准库：`std::sync::Arc`](https://doc.rust-lang.org/std/sync/struct.Arc.html)

官方资料用于核对共享拥有、clone/drop 计数和 Send/Sync 约束；Policy/worker 场景、示例与练习为原创。
