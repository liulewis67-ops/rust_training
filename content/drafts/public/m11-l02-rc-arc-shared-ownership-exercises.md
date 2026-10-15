# M11-L02 短练习：`Rc<T>` / `Arc<T>` 共享所有权

## 1. 预测：clone 了什么，数据何时 drop？

```rust
use std::rc::Rc;

let shared = Rc::new(String::from("cache-key"));
let a = Rc::clone(&shared);
let b = Rc::clone(&a);
drop(a);
drop(shared);
println!("{}", b);
```

逐行预测共享强计数，并说明 String 是否被复制、哪条语句之后 String 才可销毁。若把 `Rc::clone(&shared)` 改成 `(*shared).clone()`，有什么变化？

**分层提示**

1. 创建 Rc 后先有几个强拥有句柄？
2. 每次 Rc clone 添加的是 handle，drop 只销毁当前变量持有的一份。
3. String 的 Clone 与 Rc 的 Clone 是两个不同操作。

## 2. 修复：线程边界选 Arc，但不要声称包装就能修好 T

```rust
use std::cell::RefCell;
use std::rc::Rc;
use std::thread;

let value = Rc::new(RefCell::new(4));
let worker = Rc::clone(&value);
let handle = thread::spawn(move || *worker.borrow());
assert_eq!(handle.join().unwrap(), 4);
```

修复“两个线程共享一份只读配置”这一真实需求，并说明：

1. 为什么 Rc 不满足线程边界？
2. 为什么直接换成 `Arc<RefCell<i32>>` 仍不能通过 `thread::spawn` 的约束？
3. 对本题的只读需求，最小合适类型是什么？若需求改为多个线程写入，需再加什么同步策略？

**分层提示**

1. 检查闭包跨线程 move 的值需要实现哪些 marker trait。
2. Arc 只让共享计数原子化，不会令 RefCell 变成 Sync。
3. 对只读整数可直接 Arc；共享可变时考虑 Arc<Mutex<T>>，而不是假定 Arc 自动加锁。

## 3. 实现：验证单线程 DAG 与线程共享配置

实现一个 `Policy { retries: u8 }` 和两个小接口：

```rust
pub fn local_pair(policy: Rc<Policy>) -> (Rc<Policy>, Rc<Policy>);
pub fn parallel_read(policy: Arc<Policy>) -> (u8, u8);
```

- `local_pair` 返回两个共享同一分配的单线程句柄；测试使用 `Rc::ptr_eq` 和 `Rc::strong_count` 验证 clone/drop 数量。
- `parallel_read` 将 Arc clone 给两个线程，只读并返回 retries；join 两个线程后结果一致，调用者原有 Arc 仍可用。
- 通过一个只在最后 owner drop 时递增的计数器验证值只销毁一次。
- 不用 `unsafe`，不引入第三方 crate，也不为只读场景添加锁。

**分层提示**

1. `Rc::clone` 和 `Arc::clone` 都共享分配；单线程和跨线程选择依照 sharing topology。
2. `thread::spawn` 闭包中需要 move 进去的是 Arc handle，不必移动原有的唯一变量。
3. Arc<T> 的 Send/Sync 条件取决于 T；本题的 Policy 只含 u8，适合安全共享只读。
