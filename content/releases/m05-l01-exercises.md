# M05-L01：共享借用与独占借用练习

先完成每题，再展开文末的公开参考答案。依赖 M04-L06。

## 1. 预测：两个共享读者

```rust
/// Reads the same owned value through two shared borrows.
fn main() {
    let name = String::from("Mina");
    let first = &name;
    let second = &name;
    println!("{first} / {second} / {name}");
}
```

预测输出，说明三个位置分别读取什么，并解释创建两个 `&String` 后 `name` 为什么仍可用。

**契约：** 输出 `Mina / Mina / Mina`；说明两个共享借用只读同一个 owner 值，不移动或复制 `String`。

**分层提示：** ① `&name` 会取得 owner 吗？② 两个引用都能做什么？③ 最后一个表达式读取的是哪个绑定？

## 2. 修复：共享读取与可变写入冲突

```rust
/// Tries to read through a shared borrow and mutate through an exclusive one.
fn main() {
    let mut status = String::from("queued");
    let reader = &status;
    let writer = &mut status;
    writer.push_str(" for review");
    println!("before: {reader}; after: {writer}");
}
```

当前程序不能编译。修复冲突，使程序按顺序输出 `before: queued`、`after: queued for review`。保留读取步骤、追加步骤和两项输出；用两个显式作用域隔开借用。

**契约：** 正确版本编译并输出两行；指出 `reader` 在读取完成前与 `writer` 的独占借用冲突，并说明作用域如何让两者不重叠。

**分层提示：** ① 读取 `reader` 后才结束第一个作用域。② 在第二个作用域创建 `writer`。③ 两段代码操作相同 owner，但借用窗口分开。

## 3. 实现：借用并修改工单标题

补全 `append_marker`：读取共享输入标记并把它追加到可变标题中。不得移动标题、克隆字符串或硬编码最终标题。

```rust
/// Appends a borrowed marker to an owned title through an exclusive borrow.
fn append_marker(title: &mut String, marker: &str) {
    // TODO: Append marker to title.
}

/// Keeps the owned title and marker after the call.
fn main() {
    let mut title = String::from("deploy");
    let marker = " ready";
    append_marker(&mut title, marker);
    println!("title: {title}; marker: {marker}");
}
```

**契约：** 输出 `title: deploy ready; marker:  ready`；函数用 `&mut String` 修改 owner 的值，通过 `&str` 读取标记。调用后 `title` 和 `marker` 均可读。

**分层提示：** ① `title` 已经通过独占引用借给函数。② `String::push_str` 可接收字符串切片。③ 直接追加借来的 `marker`，不要取得它的所有权。

## 参考答案

1. 输出 `Mina / Mina / Mina`。`first` 和 `second` 都是 `name` 的共享引用；它们允许读取同一字符串，不移动或复制 owner。
2. 将共享读取放入独立作用域，再创建可变引用：

   ```rust
   let mut status = String::from("queued");
   {
       let reader = &status;
       println!("before: {reader}");
   }
   {
       let writer = &mut status;
       writer.push_str(" for review");
       println!("after: {writer}");
   }
   ```

3. `append_marker` 的函数体为 `title.push_str(marker);`。输出 `title: deploy ready; marker:  ready`；标题通过独占引用修改，marker 仍由调用方拥有。
