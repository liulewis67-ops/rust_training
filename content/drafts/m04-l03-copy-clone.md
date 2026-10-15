# M04-L03：`Copy`、`Clone` 与成本

## 学完后

- 区分赋值和按值传参中 `Copy` 类型的隐式复制与非 `Copy` 类型的 move。
- 用显式 `.clone()` 为可克隆值创建另一个值，并说明“克隆”的含义取决于类型。
- 根据类型与调用位置评估复制/克隆可能产生的成本，不把 `Clone` 一概说成廉价。
- 说明 move 是所有权语义，不等于运行时必然把堆内容搬到另一个物理地址。

## 先修

完成 M04-L02，能在赋值、按值参数与返回表达式处追踪 `String` 的 owner。这里比较 `u32`、`String` 和派生 `Copy` 的小型结构体；尚不使用引用、智能指针或部分移动。

## `Copy`：赋值后仍能使用原绑定

普通绑定使用 move 语义。若类型实现 `Copy`，赋值与按值传参则复制值，源绑定仍然有效。整数等简单标量可实现 `Copy`；`String` 拥有可变长度缓冲区，因此不实现 `Copy`。

```rust
/// Shows that assigning a Copy value leaves the source usable.
fn main() {
    let original = 12_u32;
    let assigned = original;
    println!("original: {original}, assigned: {assigned}");
}
```

输出为 `original: 12, assigned: 12`。同一特征也适用于按值参数：

```rust
/// Reports a copied scalar without consuming the caller's value.
fn report(level: u32) {
    println!("level: {level}");
}

/// Keeps using the scalar after passing it by value.
fn main() {
    let level = 3;
    report(level);
    println!("still available: {level}");
}
```

函数参数得到 `level` 的副本，所以调用者的绑定仍可用。这里描述的是语言可观察到的语义；编译器可能优化掉实际的位复制。

自定义类型只有在字段都实现 `Copy` 且类型不实现 `Drop` 时，才能实现 `Copy`。派生时要同时声明 `Clone`，因为 `Copy` 是 `Clone` 的子 trait：

```rust
/// A small value whose fields are all Copy.
#[derive(Debug, Copy, Clone)]
struct GridPoint {
    x: i32,
    y: i32,
}

/// Copies a point on assignment.
fn main() {
    let first = GridPoint { x: 2, y: 5 };
    let second = first;
    println!("first: {first:?}; second: {second:?}");
}
```

这里两个绑定都可用。若字段含 `String`，就不能为整个结构体派生 `Copy`；具有资源清理行为的 `Drop` 类型也不能实现 `Copy`。不要仅为省去一次显式 `.clone()` 就给类型添加 `Copy`：这会改变赋值和传参的可观察所有权行为。

## `Clone`：显式请求一个副本

`Clone` 需要通过 `.clone()` 显式调用。对于 `String`，克隆会产生内容独立的新 `String`；两份值可以分别修改：

```rust
/// Creates an explicit independent String clone.
fn main() {
    let mut original = String::from("draft");
    let mut duplicate = original.clone();
    original.push_str(" one");
    duplicate.push_str(" two");
    println!("original: {original}");
    println!("duplicate: {duplicate}");
}
```

输出为 `original: draft one` 与 `duplicate: draft two`。对于这种拥有文本缓冲区的类型，克隆通常需要分配并复制内容，因而可能明显比复制整数更昂贵；是否克隆应表达真实的数据需求，不该用来掩盖不清楚的所有权设计。

但 `Clone` 并不承诺“深拷贝”：它定义的是如何产生另一个该类型的值。克隆引用会得到指向同一对象的另一个引用；克隆引用计数智能指针（如 `Rc`、`Arc`）通常增加引用计数并共享底层对象。成本与独立性必须结合具体类型的 `Clone` 实现判断。

## move 不描述物理搬迁

```rust
/// Moves a String into a new binding without promising a physical relocation.
fn main() {
    let source = String::from("map");
    let destination = source;
    println!("{destination}");
}
```

这段代码在语言层面将 owner 从 `source` 转给 `destination`；此后不能通过 `source` 使用该值。但这个语义不规定机器地址必须改变，也不保证堆缓冲区被复制。反过来，`Copy` 表示源绑定仍然有效，也不要求机器码必须执行一条独立的复制指令：优化器可以消除不影响可观察结果的操作。

```text
语义状态：
  move：source 不再是可用 owner；destination 接管值
  Copy：original 仍可用；assigned 得到相同值

物理实现：
  由编译器与优化决定；不要仅凭 move / Copy 关键词推断地址或指令
```

## 检查顺序

1. 先查具体类型是否实现 `Copy`；不能因为值“看起来简单”就猜测。
2. 对 `Copy` 值，确认赋值或按值传参后源绑定仍可用。
3. 对非 `Copy` 值，区分 move 与显式 `.clone()`；后者调用类型实现的克隆行为。
4. 讨论成本时说清具体类型和资源：`u32` 的复制很小，`String` 的 clone 可能分配并复制缓冲区；其他类型可能共享资源。
5. 把所有权语义与编译器最终生成的物理操作分开描述。

## 来源

- [The Rust Programming Language：What Is Ownership?](https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html)
- [The Rust Reference：Special types and traits](https://doc.rust-lang.org/reference/special-types-and-traits.html)
- [Rust standard library：`Clone`](https://doc.rust-lang.org/std/clone/trait.Clone.html)

正文、输出示例、图示和练习为原创；来源用于核对 `Copy`/`Clone` 约束、类型实现含义及所有权语义。
