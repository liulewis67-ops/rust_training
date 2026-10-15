# M12-L02 短练习：Send/Sync 与共享模型

## 1. 预测：哪种值能进入 worker？

```rust
use std::cell::RefCell;
use std::rc::Rc;
use std::sync::{Arc, Mutex};

struct Config { retries: u8 }
let rc = Rc::new(Config { retries: 2 });
let arc = Arc::new(Config { retries: 3 });
let cell = Arc::new(RefCell::new(4_u8));
let mutex = Arc::new(Mutex::new(5_u8));
```

判断以下任务的类型边界：把 rc move 到 worker 并只读；把 arc move 到 worker 并只读；把 cell move 到 worker；把 mutex move 到两个 worker 并逐个加一。说明每个可行/不可行选择失败在哪个 marker trait 上，线程 join 返回的值还须满足什么约束。

**分层提示**

1. 区分“闭包拥有值”与“该值是否 Send”。
2. Arc 的 atomic count 不改变内部 T；RefCell 不是 Sync。
3. Mutex 的 lock guard 序列化写入；join 传回的值也要求 Send。

## 2. 修复：不要把 Arc 当作万能线程安全包装

```rust
use std::cell::RefCell;
use std::sync::Arc;
use std::thread;

fn read_setting(setting: Arc<RefCell<String>>) -> thread::JoinHandle<String> {
    thread::spawn(move || setting.borrow().clone())
}
```

服务只需要多个线程并发读取同一个不可变设置。修复签名和实现，不添加 Mutex/RwLock；调用方在 worker join 后仍能读到原设置。解释 Arc<T> 对 T 的要求以及为什么当前用例不需要内部可变性。

**分层提示**

1. 先删除没有业务理由的 RefCell；只读 String 不需内部可变性。
2. 共享拥有用 Arc<String>；Arc clone 指向同一分配。
3. 若方法只需读取字段，直接借用 `&String` / deref；无需锁。

## 3. 实现：用共享计数器区分 Arc 与 Mutex 的职责

实现 `parallel_increment(worker_count: usize, increments_per_worker: usize) -> thread::Result<usize>`：创建一个 `Arc<Mutex<usize>>` 计数器，启动 worker_count 个线程，每个线程加 increments_per_worker 次，join 所有线程，并在最后返回计数值。

补测试覆盖 1×1、3×20 和 0 个 worker；说明 Arc 提供什么、Mutex 提供什么、锁 guard 在哪里释放。若 join panic，函数不得把错误静默转成 0。

**分层提示**

1. 每个 worker clone 一个 Arc handle 并 move 入 closure。
2. 每次更新先 lock，再经 guard 修改；guard 离开迭代体后释放。
3. 逐个 join 并传播 thread::Result；只有全部结束才读取最终计数。计数 0 worker 时合法返回 0。
