# M11-L04 短练习：Weak、Drop 与拥有图

## 1. 修复：将父回指改为非拥有关系

```rust
use std::cell::RefCell;
use std::rc::Rc;

struct Node {
    parent: RefCell<Option<Rc<Node>>>,
    children: RefCell<Vec<Rc<Node>>>,
}

fn attach(parent: &Rc<Node>, child: &Rc<Node>) {
    *child.parent.borrow_mut() = Some(Rc::clone(parent));
    parent.children.borrow_mut().push(Rc::clone(child));
}
```

保留“父拥有子、子可以在父仍存活时回看父”的行为，但修复强引用环。补上获取父节点名称的安全函数，并解释父节点已经释放时的返回值。

**分层提示**

1. 父节点需要强拥有 child；child.parent 不负责父节点生命周期。
2. 把 parent 字段改为 `Option<Weak<Node>>`，attach 时对父 Rc 调用 `Rc::downgrade`。
3. 读取 parent 时用 `Weak::upgrade`；目标失效时返回 `None`，不要 unwrap。

## 2. 实现：让 Drop 证据验证树形生命周期

实现 `TreeNode`，支持：创建节点、把 child 接入 parent、child 弱回指 parent、读取已存活 parent 的名称。实现测试验证：

1. 子节点能够 upgrade 到仍存活的父节点，并读到名称。
2. 丢弃根节点且只保留 child 时，child 的 parent upgrade 返回 `None`。
3. 丢弃最后一个 child 后，所有节点的 Drop 计数均恰好增加一次。

不得用 sleep、全局变量或 strong_count 快照替代生命周期断言。

**分层提示**

1. 节点计数器可以是共享的 `Rc<Cell<usize>>`，每个节点 drop 时增加一次。
2. parent.children 存放 `Rc<TreeNode>`；child.parent 存放 `Weak<TreeNode>`。
3. 单独保留 child 使它在 root drop 后仍活着，因此能观察 parent upgrade 失败；最后 drop child 后核对 Drop 次数。

## 3. 设计评审：选择缓存树的拥有关系

缓存管理器拥有若干条目；条目需要访问父组，父组需要枚举子条目；调用方可能暂存一个条目 handle。比较以下方案并给出一份关系图或伪类型：

- A：管理器强拥有组、组强拥有条目、条目强拥有组、调用方也强拥有条目。
- B：管理器强拥有组、组强拥有条目、条目弱回指组、调用方可选择暂存强 handle。
- C：管理器在 arena 中统一拥有组和条目，所有关系使用稳定 ID。

说明每种方案的循环/清理风险、父对象释放后的访问行为、调用方是否能延长条目生命周期；指出在何种“组与条目严格共同生命周期”约束下 C 可能比 Rc/Weak 简单。

**分层提示**

1. 数出 A 图中的强环；管理器 drop 后仅靠内部 strong count 是否能清零？
2. B 中 child 的 Weak 升级可能失败，调用方自己持有的 Rc 会延长条目生命周期。
3. C 把生命周期集中到 arena；ID 需在删除/复用时验证有效性，且不能让外部 ID 自动拥有对象。
