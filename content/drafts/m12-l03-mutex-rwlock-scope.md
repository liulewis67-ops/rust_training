# M12-L03：`Mutex` / `RwLock` 与锁范围

## 学完后

- 依据“多数访问是读还是写”选择 Mutex 或 RwLock，而不是仅凭类型名称。
- 通过 guard 的作用域确定锁何时释放。
- 使用 `try_lock` / `try_write` 可重复观察冲突，不靠 sleep 或卡住线程复现问题。
- 修复读取 guard 活着时再次申请写锁的错误，并在真正写入前重新核对状态。
- 让临界区只覆盖受保护状态的读写，避免把慢工作、回调或无关计算放进锁里。

## 先修

完成 M12-L02，理解 `Send` / `Sync`、Arc 的内部类型限制和 Mutex 的共享修改边界。这里继续使用标准库线程同步，不引入 async 锁、channel、有界队列或复杂锁序。

## Mutex 与 RwLock 表达不同访问模式

`Mutex<T>` 一次只允许一个持有者通过 guard 访问 T，读和写都互斥。`RwLock<T>` 区分共享读 guard 与独占写 guard：可以同时有多个 reader，writer 必须等到所有 readers 释放，并且写 guard 存在时没有其他读写访问。

如果状态常被读取、写入很少，RwLock 可以表达“读不改值、写独占修改”的协议；如果读写都短且频率差不多，Mutex 往往更简单。RwLock 不保证 writer 与新 readers 之间的优先级，具体策略取决于平台实现；不能用它承诺公平排队，也不能仅凭锁名推断性能更好。

```rust
use std::sync::RwLock;

let state = RwLock::new(10_u32);
let first_reader = state.read().expect("lock should not be poisoned");
let second_reader = state.read().expect("lock should not be poisoned");
assert_eq!(*first_reader + *second_reader, 20);
assert!(state.try_write().is_err());
drop((first_reader, second_reader));

let mut writer = state.write().expect("lock should not be poisoned");
*writer += 1;
drop(writer);
assert_eq!(*state.read().expect("lock should not be poisoned"), 11);
```

`try_write()` 不等待；有 reader 活着时会返回 `WouldBlock`。显式 `drop` 立即结束 guard，释放锁。通常让 guard 随小作用域结束更清楚。

## guard 的生命期就是锁的持有区间

锁方法返回 RAII guard。只要 guard 还活着，互斥/读写约束就持续有效。即使源码后面没有再用 guard，也不要让它跨过不相关工作、I/O、回调或很长的计算：别的线程会继续等锁。

常见错误是在读 guard 仍然存活时申请写锁。为了避免真实代码卡住，可用非阻塞 try_write 重现冲突：

```rust
use std::sync::RwLock;

let state = RwLock::new(Some(String::from("ready")));
let current = state.read().expect("lock should not be poisoned");
if current.is_none() {
    let result = state.try_write(); // WouldBlock: current still holds a read guard.
    assert!(result.is_err());
}
```

写入前先在短作用域里提取只读结论。取得写 guard 后再核对一次，因为其它线程可能在两次锁之间改变状态：

```rust
use std::sync::RwLock;

fn set_default_if_empty(state: &RwLock<Option<String>>, candidate: String) -> bool {
    let was_empty = {
        let current = state.read().expect("lock should not be poisoned");
        current.is_none()
    };
    if !was_empty {
        return false;
    }

    let mut current = state.write().expect("lock should not be poisoned");
    if current.is_some() {
        return false;
    }
    *current = Some(candidate);
    true
}
```

读 guard 在代码块末尾 drop。随后写 guard 独占访问，并进行最终检查，避免覆盖另一线程刚写入的值。锁作用域不只是性能优化，也决定操作之间是否具有正确的同步语义。

## 用 try-lock 比较“错误持锁”和释放后的行为

```rust
use std::sync::{Mutex, TryLockError};

let count = Mutex::new(3);
let guard = count.lock().expect("lock should not be poisoned");
assert!(matches!(count.try_lock(), Err(TryLockError::WouldBlock)));
drop(guard);
assert!(count.try_lock().is_ok());
```

这段检查不依赖线程运行时序：同线程自己持有 guard 时，try_lock 明确返回 WouldBlock；guard drop 后立即能够重新取得锁。不要把 `try_lock().is_err()` 一概说成争用，锁毒化时也可能返回另一个错误分支。

## 设计锁范围

- 在锁内只读/更新受保护状态，然后马上释放 guard。
- 在锁外执行格式化、日志输出、I/O、等待和可能调用用户代码的回调。
- 若一次业务操作需要读、再写，释放读 guard 后再申请写 guard，并在写锁内重验不变量。
- 若必须同时持有多把锁，给出固定顺序；本节不构造会卡住的双锁演示。
- 锁只同步访问，不会自动定义业务冲突如何解决；例如“最后写入获胜”仍需明确契约。

## 分层提示

1. **策略提示**：写入是否罕见且读量很大？否则 Mutex 通常能避免不必要的策略复杂度。
2. **guard 提示**：查看 read()/write()/lock() 返回的 guard 到哪个花括号结束；锁在 guard drop 时才释放。
3. **非阻塞提示**：拿着 read guard 时用 try_write 重现冲突，避免在同一线程上调用阻塞 write 导致卡住。
4. **竞态提示**：先读后写之间可能有其他 writer；独占 guard 内要重查条件。
5. **临界区提示**：锁内只保留受保护数据的必要操作；把 I/O 或用户 callback 移到 guard 释放之后。

## 来源

- [Rust 标准库：`Mutex<T>`](https://doc.rust-lang.org/std/sync/struct.Mutex.html)
- [Rust 标准库：`MutexGuard` 与 RAII 解锁](https://doc.rust-lang.org/std/sync/struct.MutexGuard.html)
- [Rust 标准库：`RwLock<T>`](https://doc.rust-lang.org/std/sync/struct.RwLock.html)
- [Rust 标准库：`RwLockWriteGuard`](https://doc.rust-lang.org/std/sync/struct.RwLockWriteGuard.html)

官方资料用于核对读写互斥策略、guard drop 解锁、非阻塞锁冲突及 RwLock 不保证平台间公平性的事实；配置初始化情境和练习为原创。
