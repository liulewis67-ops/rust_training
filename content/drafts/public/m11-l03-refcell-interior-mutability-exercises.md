# M11-L03 短练习：RefCell 与内部可变性

## 1. 预测：哪次借用合法？冲突如何返回？

```rust
let state = RefCell::new(String::from("ready"));
let first = state.borrow();
let second = state.borrow();
let conflict = state.try_borrow_mut();
drop(first);
let still_conflicts = state.try_borrow_mut();
drop(second);
let now_allowed = state.try_borrow_mut();
```

分别判断两次共享 borrow、每次 `try_borrow_mut` 的结果。说明 `borrow_mut()` 在 `second` 仍存活时的行为与 try 方法有什么不同。答案中逐一标出 guard 何时释放。

**分层提示**

1. RefCell 使用 Rust 相同的共享/独占规则，只把冲突检查放到运行期。
2. 一个 reader drop 后另一个 reader 仍活着，独占借用仍不能成立。
3. `try_borrow_mut` 报 Err；`borrow_mut` 会 panic。

## 2. 修复：让读 guard 在写操作前结束

```rust
use std::cell::RefCell;

fn append_recovery(state: &RefCell<Vec<String>>) {
    let events = state.borrow();
    if events.last().is_none_or(|event| event != "ready") {
        state.borrow_mut().push(String::from("ready"));
    }
}
```

保留“末项不是 ready 才追加”的行为，修复运行时借用冲突。写出最小的作用域调整，并解释实际借用发生在何时结束。不要把 borrow 全部替换成 try 方法或捕获 panic。

**分层提示**

1. 先在共享借用的作用域内计算一个 bool。
2. 让 Ref<Vec<_>> 离开小作用域，再执行 borrow_mut。
3. 再检查末项已是 ready 和空列表两个路径都符合原契约。

## 3. 补测试：验证内部记录器的合法共享和冲突反馈

给定有 `EventLog { events: RefCell<Vec<String>> }` 的 API：

```rust
impl EventLog {
    pub fn record(&self, event: String);
    pub fn with_events<R>(&self, inspect: impl FnOnce(&[String]) -> R) -> R;
    pub fn try_record(&self, event: String) -> Result<(), BorrowMutError>;
}
```

补一组集成测试：

1. 通过 `record(&self, ...)` 连续添加两个事件，再经 `with_events` 共享读取并断言原顺序。
2. 在 `with_events` 回调仍持有只读 guard 时调用 `try_record`，断言返回错误且原数据未变化；离开回调后再次调用成功。
3. 解释为什么这证明了 RefCell 的单线程动态借用检查，却不证明跨线程同步。

**分层提示**

1. `with_events` 的回调执行期间 Ref guard 必须仍然存活。
2. 读 guard 活着时，`try_record` 的 try_borrow_mut 应返回 `Err`，不能破坏已有数据。
3. guard 释放后再写入；线程间互斥需要 Mutex/RwLock。
