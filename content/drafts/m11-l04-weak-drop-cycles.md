# M11-L04：`Weak<T>`、`Drop`、引用循环与资源清理

## 学完后

- 说明 `Rc<T>` 强引用表达拥有关系，`Weak<T>` 不延长被拥有值的生命周期。
- 使用 `Rc::downgrade` 和 `Weak::upgrade` 表达可失效的反向关系。
- 通过 Drop 观察最后一个强 owner 释放时的清理行为。
- 解释强引用环为何让强计数无法归零，并以弱边打破不需要拥有的关系。
- 区分“值已释放”与“Weak 分配控制块可能仍存在”。

## 先修

完成 M11-L03，能读懂 `Rc<RefCell<T>>` 的单线程共享可变结构，并完成 M11-L02 的 Rc 强拥有与 drop 计数。这里使用 `Rc` 展示单线程对象关系；不涉及跨线程的 `Arc<Weak<T>>`。

## 拥有边与观察边

强 `Rc<T>` 是拥有边：它增加 strong count，只有强计数归零时，内部的 `T` 才会被 drop。`Rc::downgrade(&owner)` 创建 `Weak<T>`，只登记一个非拥有观察关系，不增加 strong count。尝试访问目标前要调用 `upgrade()`：目标还活着时得到 `Some(Rc<T>)`，强计数归零后得到 `None`。

树结构通常由父节点强拥有子节点，而子节点只观察父节点。这样父亲销毁会释放它拥有的子树；子节点若因其他强 owner 暂时存活，仍能安全地检查父节点是否存在：

```rust
use std::cell::RefCell;
use std::rc::{Rc, Weak};

struct Node {
    parent: RefCell<Option<Weak<Node>>>,
    children: RefCell<Vec<Rc<Node>>>,
}

fn attach(parent: &Rc<Node>, child: &Rc<Node>) {
    *child.parent.borrow_mut() = Some(Rc::downgrade(parent));
    parent.children.borrow_mut().push(Rc::clone(child));
}

fn parent_is_alive(child: &Node) -> bool {
    child.parent.borrow().as_ref().and_then(Weak::upgrade).is_some()
}
```

`upgrade()` 得到的临时 Rc 自己也是一个强 owner；不要让它不必要地跨越很大的作用域。如果 `upgrade()` 返回 `None`，应把这个观察对象当成已销毁，并由调用方处理。

## 强循环会让对象永远等不到清零

若两个对象都用 Rc 强拥有对方，初始局部 owner drop 后，双方仍各被对方持有。强计数都不为零，Drop 不执行，内部资源也无法按正常所有权路径释放。Rust 保证内存安全，但不保证自动回收引用计数环；这是一种内存泄漏：

```rust
use std::cell::RefCell;
use std::rc::Rc;

struct CycleNode {
    next: RefCell<Option<Rc<CycleNode>>>,
}

let left = Rc::new(CycleNode { next: RefCell::new(None) });
let right = Rc::new(CycleNode { next: RefCell::new(None) });
*left.next.borrow_mut() = Some(Rc::clone(&right));
*right.next.borrow_mut() = Some(Rc::clone(&left));
drop(left);
drop(right);
// Both nodes remain strongly owned by the opposite node.
```

这不是 use-after-free，也不是借用检查失效：两个值仍然活着，只是没有外部代码能再找到它们。检查拥有图中的边，决定哪些关系真的表示“负责其生命周期”。树的父子拥有方向适合强边向下、弱边向上；图结构则要明确选一棵拥有树，其余反向或关联边用 Weak 或 ID 表达。

## Drop 用于观察确定的清理边界

Rust 在值离开作用域时自动运行析构；结构体字段随后也按声明顺序清理。通常不需要手动实现 `Drop`，文件、socket 等标准资源类型已经管理其清理。教学或诊断代码可用 Drop 计数器观察某个值何时真的销毁：

```rust
use std::cell::Cell;
use std::rc::Rc;

struct Probe(Rc<Cell<usize>>);

impl Drop for Probe {
    fn drop(&mut self) {
        self.0.set(self.0.get() + 1);
    }
}

let drops = Rc::new(Cell::new(0));
let value = Rc::new(Probe(Rc::clone(&drops)));
let observer = Rc::downgrade(&value);
drop(value);
assert_eq!(drops.get(), 1);
assert!(observer.upgrade().is_none());
```

不要直接调用 `Drop::drop`，也不要把 Drop 当成任意时机调用的回调。显式 `drop(value)` 是把拥有值移出当前作用域并立即结束其生命周期。Drop 应聚焦释放该值负责的资源，保持简单且不 panic；不要在析构逻辑中重建强引用环。

Weak 句柄本身仍需被 drop。强计数归零后，`T` 已被销毁；控制块会在剩余 Weak 句柄也释放后回收。实际业务逻辑不要通过 weak_count/strong_count 的快照决定正确性，它们适合诊断与教学观察，不能代替明确的拥有关系。

## 选择图中的所有权

| 关系 | 常见表达 | 生命周期效果 |
|---|---|---|
| 父节点拥有子节点 | `Rc<Child>` | 子节点至少活到父节点释放或子节点另有 owner |
| 子节点回看父节点 | `Weak<Parent>` | 不延长父节点生命周期，升级后可能失败 |
| 节点仅标识另一个对象 | 稳定 ID / arena key | 不产生隐式强拥有边，由容器统一管理对象 |
| 多线程共享 | `Arc<T>` / `Weak<T>` | 需满足线程 trait 边界；本节样例不覆盖 |

## 分层提示

1. **边提示**：箭头表示谁对目标生命周期负责？它应增加 strong count 吗？
2. **升级提示**：Weak 访问前要 `upgrade`；结果是 `Option<Rc<T>>`，None 是正常的目标失效路径。
3. **循环提示**：沿强边数每个节点的强计数。丢掉局部变量后，是否仍有环内入边？
4. **Drop 提示**：只有 strong count 归零才 drop 内部 T；保留 Weak 不会保留 T，但会保留所需控制块。
5. **图建模提示**：双向导航不意味着双向拥有。选一组拥有边，其它回指边改为 Weak 或显式 ID。

## 来源

- [The Rust Programming Language：引用循环会造成泄漏](https://doc.rust-lang.org/book/ch15-06-reference-cycles.html)
- [Rust 标准库：`Weak<T>`](https://doc.rust-lang.org/std/rc/struct.Weak.html)
- [Rust 标准库：`Drop` 与析构顺序](https://doc.rust-lang.org/std/ops/trait.Drop.html)
- [Rust 标准库：`std::rc`](https://doc.rust-lang.org/std/rc/)

官方资料用于核对强/弱计数、upgrade 失效、Drop 触发与字段清理语义；树形关系、诊断样例和练习为原创。
