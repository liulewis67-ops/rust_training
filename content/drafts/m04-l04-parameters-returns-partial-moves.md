# M04-L04：函数参数、返回值与部分移动

## 学完后

- 逐字段跟踪结构体按值传入函数后发生的部分移动。
- 在部分移动后使用仍有效的未移动字段，并识别不能再整体使用的值。
- 设计按值参数与返回值，让函数接口明确表达 owner 如何进入和离开函数。
- 通过重新构造完整结构体，把选定字段与新值一并返回给调用方。

## 先修

完成 M04-L03，能比较 `Copy`、move 与显式克隆。以下例子使用带 `String` 字段的结构体；只有所有字段都已移动或使用完毕，才能把 owner 的数据流画完整。本节不使用引用或 `Drop` 实现。

## 按值参数接收整个结构体

参数类型是 `Message` 时，调用把整个结构体按值交给函数。`String` 字段不会被隐式复制。函数可以逐字段取出值；每取出非 `Copy` 字段，就发生该字段的部分移动：

```rust
/// Owns the title and body of a message.
struct Message {
    title: String,
    body: String,
}

/// Consumes a message and returns its body to the caller.
fn take_body(message: Message) -> String {
    let title = message.title;
    println!("received: {title}");
    message.body
}

/// Receives the returned field under a new owner.
fn main() {
    let message = Message {
        title: String::from("build"),
        body: String::from("ready"),
    };
    let body = take_body(message);
    println!("returned: {body}");
}
```

输出为 `received: build`、`returned: ready`。调用将整个 `message` 移入参数。函数先将 `title` 移入局部绑定；此后 `message.title` 已移动，但尚可读取 `message.body`。返回表达式将 body 的 owner 交给调用方的 `body` 绑定。`message` 作为整体不会自动回到调用方。

## 部分移动后哪些表达式仍合法

下面在移动 `title` 后读取剩余字段 `body`，合法；最后尝试打印整体 `message`，非法：

```rust
/// Owns a title and body as separate String fields.
#[derive(Debug)]
struct Message {
    title: String,
    body: String,
}

/// Tries to use a partially moved structure as a whole.
fn invalid_use(message: Message) {
    let title = message.title;
    println!("title: {title}");
    println!("body: {}", message.body);
    println!("whole message: {message:?}");
}
```

最后一行再次读取已移动的 `title`，会触发 E0382。若改为 `println!("{:?}", message)`，也不能整体使用一个已有字段部分移动的值。正确版本应只访问尚未移动的字段，并将它们分别消费或返回。

还要区分部分移动与 `Copy` 字段：若结构体另有 `u32` 字段，将其读出不会使该字段失效；但包含非 `Copy` 字段的整体仍不能当作完整值使用。实现了 `Drop` 的类型不能从字段部分移动，因为其析构回调需要完整的 `self`；本节的 `Message` 未实现 `Drop`。

## 返回接口表达 owner 数据流

需要调用方继续拥有多个字段时，不要只返回其中一个却假设原结构体仍可用。可以在函数内消费输入、重组一个完整输出值并返回：

```rust
/// Owns a title and body as separate String fields.
struct Message {
    title: String,
    body: String,
}

/// Consumes an old message and returns a complete updated message.
fn add_prefix(message: Message, prefix: String) -> Message {
    let title = format!("{prefix}{}", message.title);
    Message {
        title,
        body: message.body,
    }
}

/// Receives the complete value returned by the function.
fn main() {
    let original = Message {
        title: String::from("compile"),
        body: String::from("ready"),
    };
    let updated = add_prefix(original, String::from("CI: "));
    println!("{} / {}", updated.title, updated.body);
}
```

输出为 `CI: compile / ready`。`original` 与 `prefix` 都按值移入函数；函数分别消费它们的 owned 字符串，构造一个有完整字段的新 `Message` 并返回；调用点的 `updated` 接管返回值。若函数不需要把输入结构体还给调用方，返回的类型就不必声称会返回那个旧结构体。

设计接口时把每个值的路径写清：

```text
caller Message ──move──> parameter message
caller prefix  ──move──> parameter prefix
message.title + prefix ──> new title
message.body ───────────> returned Message.body
returned Message ──move──> caller binding updated
```

## 检查顺序

1. 写出结构体每个字段的类型；标出哪些字段是 `Copy`，哪些字段 move 时会失效。
2. 标出整个结构体传入函数的位置，以及每个字段读出或返回的位置。
3. 部分移动后只使用仍未移动的字段；检查是否有整体格式化、整体返回或调用需要完整值。
4. 明确函数返回的是单个字段、多个字段组成的新值，还是完整重建的结构体。
5. 检查调用方是否接住函数返回值，并依返回类型继续使用 owner。

## 来源

- [The Rust Programming Language：What Is Ownership?](https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html)
- [The Rust Reference：Destructors](https://doc.rust-lang.org/reference/destructors.html)

正文、结构体数据流图和代码案例为原创；来源用于核对赋值、函数参数/返回、部分移动及实现 `Drop` 对字段移动的限制。
