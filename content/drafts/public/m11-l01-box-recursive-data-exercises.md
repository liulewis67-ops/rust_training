# M11-L01 短练习：`Box<T>` 与递归数据

## 1. 预测：哪条边让类型大小无法确定？

分析：

~~~rust
enum Chain {
    Link(u8, Chain),
    End,
}
~~~

1. 编译器为什么不能仅凭 `End` 变体确定 `Chain` 的有限大小？
2. 把 `Chain` 的递归字段改为 `Box<Chain>` 后，递归关系还在吗？哪一层现在具有固定大小？
3. `struct Folder { children: Vec<Folder> }` 是否还需要把字段写成 `Vec<Box<Folder>>` 才能递归定义？解释两者的所有权差别。

**分层提示**

1. 跟踪 `Link` 的第二个字段，而不是看运行时何时遇到 End。
2. 区分值完整内嵌与保存一个指针。
3. 想想 `Vec<T>` 自身需要嵌入几个 `T` 才能确定大小。

## 2. 修复：修正单所有者链表的递归边

给定：

~~~rust
pub struct Node {
    pub value: i32,
    pub next: Option<Node>,
}

pub fn second_value(head: &Node) -> Option<i32> {
    head.next.as_ref().map(|node| node.value)
}
~~~

按最小改动修复递归类型，让 `second_value` 借用并读取后继节点。写出字段类型、构造两个节点的表达式，并说明为什么不应为本题改用 `Rc`。

**分层提示**

1. `Option` 能表达“没有下一个”，但不改变 `Node` 的直接内嵌大小关系。
2. 把间接层放在递归边上，`Option<Box<Node>>` 能继续表达 None/Some。
3. `head` 是借用，`as_ref()` 让 map 接收 `&Box<Node>`；检查自动解引用后的字段读取。

## 3. 实现：构造并借用遍历表达式树

实现如下 API：

~~~rust
pub enum BinaryTree {
    Leaf(i64),
    Branch {
        left: Box<BinaryTree>,
        right: Box<BinaryTree>,
    },
}

impl BinaryTree {
    pub fn leaf_sum(&self) -> i64;
}
~~~

用 `Box::new` 构造 `Branch` 并让 `leaf_sum(&self)` 通过共享借用递归求所有叶子之和，不消费整棵树。至少测试 `Branch(Leaf(4), Branch(Leaf(5), Leaf(6)))` 得到 15，并对同一个树连续调用两次。说明为什么每个二叉分支用 Box，而一组同型子目录用 `Vec<Directory>` 不需要把每项额外装 Box。

**分层提示**

1. Leaf variant 提供有限终止情形；Branch 的两个递归字段都需间接层。
2. 匹配 `&self` 时叶子值是 `&i64`，复制一个数字不会复制或移动子树。
3. `left.leaf_sum()` 利用 Box 的自动解引用；只有构造分支时才需要分配递归边。
