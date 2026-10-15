# M11-L03：`RefCell<T>` 与内部可变性

## 学完后

- 说明内部可变性允许通过共享 `&self` 接口进行受控修改，但没有废除 Rust 的借用规则。
- 解释 `RefCell<T>` 如何在运行时检查“多个共享借用或一个独占借用”。
- 用 `Ref` / `RefMut` guard 的作用域理解合法借用与冲突。
- 使用 `try_borrow` / `try_borrow_mut` 在冲突时返回错误；知道 `borrow` / `borrow_mut` 在冲突时会 panic。
- 明确 `RefCell` 的运行时检查不提供跨线程互斥或同步。

## 先修

完成 M11-L02，理解 `Rc<T>` / `Arc<T>` 的所有权和线程边界；理解普通 `&T` 与 `&mut T` 的互斥规则。本课聚焦单线程 `RefCell`，不把其运行时借用检查当成 Mutex。

## 为什么需要内部可变性

通常修改值要拿到 `&mut T`。有些对象需要保持一个共享引用接口 `&self`，同时在内部记录可变状态，例如在单线程测试桩中收集调用记录，或为不可变查询缓存统计命中数。内部可变性允许把“是否同时有共享/独占访问”的检查从编译期移到运行期；它不会让违反借用规则的访问变合法。

对 `Copy` 小值，可先看 `Cell<T>`；需要借用非 Copy 的集合或结构时，可以使用 `RefCell<T>`。不要为了少写 `&mut` 把所有字段都包进 RefCell：它会增加运行时状态和冲突路径，且可能 panic。

## RefCell 的 guard 就是动态借用

`borrow()` 返回 `Ref<T>`，`borrow_mut()` 返回 `RefMut<T>`。guard 活着期间借用一直有效；离开作用域或显式 drop guard 后借用结束。规则仍然是多个共享借用，或一个独占借用，不能同时拥有两者：

```rust
use std::cell::RefCell;

let state = RefCell::new(vec!["load"]);
let first_reader = state.borrow();
let second_reader = state.borrow();
assert_eq!(first_reader.len() + second_reader.len(), 2);
drop((first_reader, second_reader));

state.borrow_mut().push("save");
assert_eq!(state.borrow().len(), 2);
```

第二次共享 borrow 合法；所有 reader guard 释放后才开始可变 borrow。下面的冲突也会在运行时被检测：

```rust
let state = RefCell::new(7);
let reader = state.borrow();
assert!(state.try_borrow_mut().is_err());
assert_eq!(*reader, 7);
drop(reader);
assert!(state.try_borrow_mut().is_ok());
```

`try_borrow` / `try_borrow_mut` 返回 `Result`，调用方可以选择记录冲突、返回领域错误或改写控制流。若改用 `borrow_mut()`，同一个仍存活的 reader 会导致 panic；不要把 panic 当成正常冲突处理 API。

## guard 活得比预想更久

```rust
let current = state.borrow();
if current.contains("missing") {
    state.borrow_mut().push("recovered"); // reader 仍然活着，会冲突
}
```

当 `current` 最后一次使用很远、被闭包捕获或仍在外层作用域时，临时地再借一次可变引用会失败。先复制/提取需要的只读结论并让 guard 离开作用域，再开始写入：

```rust
let missing = {
    let current = state.borrow();
    current.contains("missing")
};

if missing {
    state.borrow_mut().push("recovered");
}
```

不要用 `mem::forget`、泄漏 guard 或 `unsafe` 绕过检查；那会破坏正常释放 guard 时维护的动态借用状态。

## `RefCell` 不是锁

`RefCell` 的借用标记只在单线程中执行运行时检查。多个线程同时访问需要线程同步原语，如 `Mutex<T>` / `RwLock<T>`；把 `RefCell<T>` 放进 Arc 并不会让它变成 `Sync`。Arc 负责跨线程共享拥有，锁负责协调可变访问，二者职责不同。对单线程 `Rc<RefCell<T>>`，共享所有权和动态可变性可以并用，但它仍不能跨线程。

## 分层提示

1. **变更理由**：值是否真的要变？如果可以创建新值或通过 `&mut T` 修改，就不必加内部可变性。
2. **guard 提示**：找出每一个 Ref/RefMut 存活到哪里；它们析构之前，哪些后续借用会被拒绝？
3. **冲突处理**：冲突是用户可恢复状态时用 `try_borrow*`；若用 `borrow*`，需要证明冲突不可能发生，否则就是 panic 风险。
4. **所有权提示**：Rc/Arc 决定谁共同拥有；RefCell 只在单线程动态检查共享访问与独占访问。
5. **线程提示**：跨线程的并发互斥用 Mutex/RwLock/Atomic，而不是 RefCell 的运行时借用计数。

## 来源

- [The Rust Programming Language：RefCell 与内部可变性](https://doc.rust-lang.org/book/ch15-05-interior-mutability.html)
- [Rust 标准库：`RefCell<T>`](https://doc.rust-lang.org/std/cell/struct.RefCell.html)
- [Rust Reference：内部可变性](https://doc.rust-lang.org/reference/interior-mutability.html)

官方来源用于核对运行时借用规则、guard 生命周期、panicking 与 try-borrow API，以及内部可变性与线程同步的区别；样例场景和练习为原创。
