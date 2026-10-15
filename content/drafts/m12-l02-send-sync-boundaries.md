# M12-L02：`Send` / `Sync` 与跨线程类型边界

## 学完后

- 用 `Send` 判断值能否安全地转移到另一线程。
- 用 `Sync` 判断 `&T` 能否安全地在线程间共享。
- 根据 `thread::spawn` 的闭包约束解释为什么 `Rc<T>` 不能跨线程移动。
- 说明 `Arc<T>` 只使共享引用计数原子化，不会让内部非线程安全类型自动变安全。
- 在真实共享修改需求下选择 `Arc<Mutex<T>>`，且不把锁加到纯只读数据上。

## 先修

完成 M12-L01，理解普通 spawn 将闭包送到新线程以及 join 返回 worker 结果。完成 M11-L02/L03，认识 Rc/Arc 与 RefCell；本节只引入 `Send`、`Sync`、Arc 条件和 Mutex 的基本同步边界，不展开锁顺序、毒化恢复或 channel。

## 两个不同问题：移动，还是共享引用

`Send` 表示一个值可安全地移交给另一个线程。`Sync` 表示共享引用可安全地跨线程共享；等价关系是 `T: Sync` 当且仅当 `&T: Send`。它们是 marker trait，没有方法；编译器通常根据字段自动推导组合类型是否满足这些约束。

`thread::spawn` 会把闭包本身按值送入新线程，所以闭包要 `Send`。若闭包返回值要经 `JoinHandle::join` 回到调用线程，返回值也要 `Send`。移动一个 `Arc<T>` 到 worker 时，Arc 必须是 Send；Arc 的跨线程能力要求内部 `T: Send + Sync`。

```rust
use std::sync::Arc;
use std::thread;

let policy = Arc::new(String::from("retry-3"));
let worker_policy = Arc::clone(&policy);
let worker = thread::spawn(move || worker_policy.len());

assert_eq!(worker.join().expect("worker should finish"), 7);
assert_eq!(&*policy, "retry-3");
```

字符串不可变且满足 Send/Sync，可以跨线程共享。Arc clone 复制的是原子引用计数句柄，并没有复制 String。调用线程保留的 Arc 和 worker 内的 Arc 指向同一份分配。

## `Rc<T>` 是单线程共享

Rc 的计数不是原子操作，因此 `Rc<T>` 不实现 Send，也不能通过 move closure 送到另一个线程。错误不在闭包有没有写 `move`：move 只转移闭包捕获值；它不会改变 Rc 自身的线程属性。

```rust,compile_fail
use std::rc::Rc;
use std::thread;

let local = Rc::new(String::from("one thread"));
thread::spawn(move || local.len()).join().unwrap();
```

这里应先问共享是否真的跨线程。若只是同一线程的多个 owner，保留 Rc；需要线程间共同拥有并且 T 满足线程安全约束时，才改成 Arc。

## `Arc<T>` 不会修复内部类型

Arc 只原子化共享 owner count，内部类型仍须适合共享。RefCell 用非原子运行时借用状态，因此不是 Sync；`Arc<RefCell<T>>` 仍不能作为跨线程共享的数据：

```rust,compile_fail
use std::cell::RefCell;
use std::sync::Arc;
use std::thread;

let shared = Arc::new(RefCell::new(0_u32));
thread::spawn(move || *shared.borrow()).join().unwrap();
```

不要手写 unsafe `impl Send` / `impl Sync` 来绕过错误。这些 trait 决定安全代码和 unsafe 抽象可以依赖的并发保证；错误实现可能造成数据竞争或未定义行为。先改成正确的共享模型。

## 需要共享修改时，锁保护访问

假设两个 worker 必须更新同一个计数器，Arc 提供共同拥有，Mutex 保证同一时刻只有一个线程通过 guard 访问内部值：

```rust
use std::sync::{Arc, Mutex};
use std::thread;

let count = Arc::new(Mutex::new(0_u32));
let mut workers = Vec::new();

for _ in 0..2 {
    let worker_count = Arc::clone(&count);
    workers.push(thread::spawn(move || {
        let mut guard = worker_count.lock().expect("counter lock should be available");
        *guard += 1;
    }));
}

for worker in workers {
    worker.join().expect("worker should finish");
}
assert_eq!(*count.lock().expect("counter lock should be available"), 2);
```

Mutex 的内部数据通过 lock 返回的 guard 访问；guard drop 时释放锁。Mutex 通常只要求 `T: Send` 就可以在线程间安全共享，因为锁保证一次只有一个线程拿到 `&mut T`；这与直接共享 `&T` 所要求的 `T: Sync` 是不同约束。实际代码还必须设计锁的范围、毒化策略及错误传播；本例使用固定无 panic 操作的简单计数器。

若数据只读，不要因为代码运行在线程中就套 Mutex；直接 Arc<T> 通常更简单。若单线程共享且无需跨线程，Rc 避免原子计数。按真实共享与修改关系选择类型，避免 `Arc<Mutex<T>>` 到处堆叠。

## 分层提示

1. **边界提示**：closure 被 move 到线程，是 Send 问题；`&T` 被多个线程共享，是 Sync 问题。
2. **组合提示**：看类型里每个字段和包装器自身的自动 trait；外层 Arc 不会抹掉内层 `!Sync`。
3. **共享提示**：Rc 只用于本线程；跨线程共享不可变值用满足约束的 Arc。
4. **修改提示**：多个线程修改同一普通值时，需要 Mutex/RwLock/atomic 或消息传递设计；Arc 单独只共享 owner。
5. **复杂度提示**：没有真正的跨线程共享时，不要为了“以后可能并发”先上 Arc/Mutex。

## 来源

- [The Rustonomicon：Send 与 Sync](https://doc.rust-lang.org/nomicon/send-and-sync.html)
- [Rust 标准库：`Arc<T>` 线程安全条件](https://doc.rust-lang.org/std/sync/struct.Arc.html)
- [Rust 标准库：`Mutex<T>` 与锁保护](https://doc.rust-lang.org/std/sync/struct.Mutex.html)
- [Rust 标准库：`std::rc`](https://doc.rust-lang.org/std/rc/)
- [Rust 标准库：`std::cell::RefCell<T>`](https://doc.rust-lang.org/std/cell/struct.RefCell.html)

官方资料用于核对 Send/Sync 定义、Arc 对 T 的条件、Mutex guard 访问和 Rc/RefCell 的限制；练习与 worker 场景为原创。
