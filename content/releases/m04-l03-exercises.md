# M04-L03 练习：`Copy`、`Clone` 与选择

## 1. 预测：标量按值传入后仍可用

```rust
/// Receives a copied integer.
fn show_count(count: u32) {
    println!("count: {count}");
}

/// Uses the original integer after the call.
fn main() {
    let count = 4;
    show_count(count);
    println!("after: {count}");
}
```

预测完整输出，并说明为什么 `show_count(count)` 不会让调用处的 `count` 变成 moved value。

**契约：** 输出依次为 `count: 4`、`after: 4`；回答指出 `u32: Copy`，按值传参复制语义值，不能将这个结论推广到 `String`。

**分层提示：** ① 参数类型是什么？② 它是否实现 `Copy`？③ 对照 M04-L02 的 `String` 按值传参。

## 2. 修复：保留原字符串并产生第二份文本

```rust
/// Appends a suffix to an owned String.
fn append_status(mut text: String) -> String {
    text.push_str(" ready");
    text
}

/// Tries to use the original after moving it into a function.
fn main() {
    let message = String::from("build");
    let updated = append_status(message);
    println!("updated: {updated}");
    println!("original: {message}");
}
```

当前代码在最后打印 `message` 处因 E0382 失败。修复它，使输出为 `updated: build ready` 和 `original: build`，并解释修复产生两份文本的原因。不得改变 `append_status` 的参数/返回类型或硬编码输出。

**契约：** 两行输出与顺序必须匹配；解答须说明显式克隆保留原 `String`，并指出克隆拥有文本缓冲区的成本可能包含分配与内容复制。

**分层提示：** ① 在调用发生前，怎样得到另一个 `String` 值？② 哪个绑定应被传给会修改它的函数？③ 对文本缓冲区的克隆说明可能成本。

## 3. 实现：为轻量坐标选择 `Copy`

补全 `GridPoint` 的 trait 声明与 `shift` 函数，使下列程序通过运行：

```rust
// TODO: Add the appropriate derives for a small, Copy value.
struct GridPoint {
    x: i32,
    y: i32,
}

/// Returns a shifted point without consuming the caller's point.
fn shift(point: GridPoint, dx: i32) -> GridPoint {
    // TODO: Return a point whose x coordinate is increased by dx.
    todo!()
}

/// Keeps and prints the original point after calling shift.
fn main() {
    let start = GridPoint { x: 2, y: 5 };
    let moved = shift(start, 3);
    println!("start: {},{}", start.x, start.y);
    println!("shifted: {},{}", moved.x, moved.y);
}
```

**契约：** 正确实现输出 `start: 2,5` 和 `shifted: 5,5`；类型用 `Copy` 和它所需的 `Clone` 派生，函数返回新坐标而不克隆或丢弃不必要的资源；说明该设计适用于字段全为 `Copy` 的轻量值，并非所有类型的默认选择。

**分层提示：** ① 两个字段 `i32` 是否都是 `Copy`？② `Copy` 同时要求实现哪个 trait？③ 新坐标使用 `point.x + dx` 与原 `y` 字段构造。

## 参考答案

1. 输出为 `count: 4`、`after: 4`。`u32` 实现 `Copy`，所以按值传入 `show_count` 不会让调用处的 `count` 失效；这个结论不能用于 `String`。
2. 调用前显式写 `let original_copy = message.clone();`，把 `original_copy` 传给 `append_status`，保留 `message`。输出为 `updated: build ready` 和 `original: build`。对 `String` 来说，clone 会创建独立文本，通常需要分配并复制缓冲区内容。
3. 为 `GridPoint` 添加 `#[derive(Debug, Copy, Clone)]`。在 `shift` 中返回 `GridPoint { x: point.x + dx, y: point.y }`。输出为 `start: 2,5`、`shifted: 5,5`。该值仅由 `Copy` 字段构成，适合按值复制。

## 来源

- [The Rust Reference：Special types and traits](https://doc.rust-lang.org/reference/special-types-and-traits.html)
- [Rust standard library：`Clone`](https://doc.rust-lang.org/std/clone/trait.Clone.html)
