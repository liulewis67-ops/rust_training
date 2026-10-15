# M11-L01：`Box<T>` 与递归数据

## 学完后

- 说明直接递归字段为何无法得到有限的类型大小。
- 用 `Box<T>` 在递归所有权边上引入固定大小的间接层。
- 区分拥有型递归结构、借用遍历和共享所有权。
- 用 `Box::new` 构造值，并通过解引用或自动解引用访问被拥有的值。
- 知道 `Vec<T>` 本身已具有固定大小，不需要仅为定义递归类型而把每个元素写成 `Box<T>`。

## 先修

完成 M10-L06，能按已有契约给类型增量添加能力并保留旧行为；理解 enum、struct、所有权移动、借用和 `Option<T>`。本节不使用第三方 crate。

## 从拥有关系看 Box

`Box<T>` 是拥有一个 `T` 的指针类型。创建 `Box::new(value)` 会为被指向的值分配堆内存；`Box` 本身仍是一个大小已知的值，并负责在所有权结束时释放它拥有的分配。把值装进 Box 不会复制值，也不会把它变成共享所有权；移动 Box 是移动唯一所有权。

当数据类型直接包含自身时，字段会要求编译器把完整类型继续嵌入自身，类型大小无法收敛：

~~~rust
// Intentionally invalid: the recursive field embeds the complete type.
enum BadList {
    Cons(i32, BadList),
    Nil,
}
~~~

`Nil` 表示值在运行时可以结束，不能解决类型定义阶段的问题：`BadList::Cons` 的第二个字段仍要求再内嵌一个完整 `BadList`。编译器必须先知道 `BadList` 每个值的有限大小，才能为每个 variant 布局。使用指针大小固定的间接边后，大小就能确定：

~~~rust
enum List {
    Cons(i32, Box<List>),
    Nil,
}

let list = List::Cons(3, Box::new(List::Cons(2, Box::new(List::Nil))));
~~~

Box 放在递归字段的那条边上。每个 Cons 节点仍拥有自己的尾节点；Box 没有引入引用计数或多所有者。

## 表达式树：递归拥有，按借用读取

一个小型算术 AST 可以包含子表达式：

~~~rust
#[derive(Debug, PartialEq, Eq)]
pub enum Expr {
    Number(i64),
    Add(Box<Expr>, Box<Expr>),
}

impl Expr {
    pub fn addition(left: Self, right: Self) -> Self {
        Self::Add(Box::new(left), Box::new(right))
    }

    pub fn evaluate(&self) -> i64 {
        match self {
            Self::Number(value) => *value,
            Self::Add(left, right) => left.evaluate() + right.evaluate(),
        }
    }
}

let expression = Expr::addition(Expr::Number(4), Expr::Number(5));
assert_eq!(expression.evaluate(), 9);
~~~

树的节点拥有子节点，`evaluate(&self)` 只借用树，不消耗或复制它。对 `&Box<Expr>` 调用 `evaluate` 时，方法查找会自动解引用到 `Expr`；可读性需要时也可以显式写 `left.as_ref().evaluate()`。把 Box 移动到 `let boxed = Box::new(value)` 的别处，移动的是指针所有权；持有 Box 的代码结束时，被拥有的节点会随 Box 一起清理。

示意图只表达拥有方向，不规定编译器或运行时的精确内存布局：

~~~text
Expr::Add 节点
  ├── owns Box ──> 左 Expr
  └── owns Box ──> 右 Expr
~~~

节点树没有共享边，因此 Box 是自然选择。若多个父节点必须共享同一个子节点，应在确认共享所有权需求后再学习 `Rc<T>` / `Arc<T>`，不要用 `Box` 模拟多所有者。

## 什么时候不需要 Box

`Vec<T>` 的类型大小固定为指针、长度和容量等固定大小状态，因此 `struct Directory { children: Vec<Directory> }` 可以直接递归定义；Vec 会拥有并管理元素缓冲区。不要为了“递归”机械地写成 `Vec<Box<Directory>>`，除非需要逐个移动/稳定地址、异构对象、按需分配等额外语义。普通短列表通常优先考虑 Vec，而不是手写单链 cons list。

本课使用 Box，是因为 AST 的每个递归子节点都必须有一个确定的间接边，并且树中每个子节点只有一个所有者；不是因为一切递归数据或一切较大值都应该装 Box。

## 分层提示

1. **大小提示**：枚举的每个 variant 必须参与同一个有限大小布局；哪个字段会无限重复要求完整类型？
2. **所有权提示**：这个节点是否只有一个父节点拥有？若是，Box 足够；若有多个拥有者，不要偷偷复制整棵树。
3. **操作提示**：构造时用 `Box::new`；读取时先借用 `&Expr`，利用 `Deref`/自动解引用；只有确实要转移 `T` 时才移动出 Box。
4. **容器提示**：`Vec<Directory>` 自身大小固定，先分清递归对象字段和容器内部缓冲区。
5. **设计提示**：若任务只是存放可变长度同质元素，比较 Vec；若表示 AST、树或链的递归所有权关系，选择清楚表达该边界的间接类型。

## 来源

- [The Rust Programming Language：Using Box to Point to Data on the Heap](https://doc.rust-lang.org/book/ch15-01-box.html)
- [The Rust Reference：Recursive types](https://doc.rust-lang.org/reference/types.html#recursive-types)
- [Rust standard library：`std::boxed`](https://doc.rust-lang.org/std/boxed/index.html)

官方资料用于核对递归类型有限大小约束、Box 的间接层和拥有语义；表达式树领域、代码和练习为原创。
