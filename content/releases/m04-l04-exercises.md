# M04-L04 练习：函数接口与部分移动

## 1. 修复：部分移动后只返回有效字段

```rust
/// Owns a subject and a body.
struct Note {
    subject: String,
    body: String,
}

/// Tries to return a value after moving one of its fields.
fn extract_body(note: Note) -> String {
    let subject = note.subject;
    println!("subject: {subject}");
    let body = note.body;
    println!("note still whole: {}", note.subject);
    body
}

/// Uses the returned body.
fn main() {
    let note = Note {
        subject: String::from("status"),
        body: String::from("ready"),
    };
    let body = extract_body(note);
    println!("body: {body}");
}
```

修复 `extract_body`，使输出为 `subject: status`、`body: ready`，然后将 body 返回调用方。不要克隆字段或更改函数签名。说明修复版为什么不能再整体使用 `note`。

**契约：** 修复版编译并按要求输出；解释 subject 与 body 分别何时被移动，且调用方通过返回值重新取得 body 的所有权。原始版本应由编译器拒绝。

**分层提示：** ① 已移动的 `subject` 是否能再读取？② `body` 仍可单独读取吗？③ 删掉整值/已移动字段的再次使用，让 `body` 尾表达式返回。

## 2. 实现：从按值参数取出 payload

完成 `take_payload`，打印标签，并把 payload 返回给调用方：

```rust
/// Owns a label and payload.
struct Packet {
    label: String,
    payload: String,
}

/// Consumes a packet and returns its payload.
fn take_payload(packet: Packet) -> String {
    // TODO: Print the label and return the payload.
    todo!()
}

/// Uses the owned payload returned by the function.
fn main() {
    let packet = Packet {
        label: String::from("report"),
        payload: String::from("complete"),
    };
    let payload = take_payload(packet);
    println!("payload: {payload}");
}
```

**契约：** 输出 `label: report`、`payload: complete`；函数按值接管 `Packet`，字段只消费一次，不克隆、不硬编码，并返回 payload 的 owner。

**分层提示：** ① 先将 `packet.label` 移到可打印的绑定。② 然后读取尚未移动的 `packet.payload`。③ 以该字段作为返回表达式。

## 3. 设计评审：让签名说清楚返回了什么

`Record` 含 `id: u32`、`title: String`、`body: String`。团队提出两个接口：

```rust
/// A record whose text fields are independently owned.
struct Record {
    id: u32,
    title: String,
    body: String,
}

/// Consumes the record and returns its title.
fn take_title(record: Record) -> String {
    todo!()
}

/// Consumes a record and returns a revised complete record.
fn revise(record: Record, prefix: String) -> Record {
    todo!()
}
```

评审这两个签名并画出 owner 数据流：

1. 对 `take_title`，调用者还能否使用原 `record`？函数内部能否读取 `id` 后返回 `title`？`body` 应如何处理？
2. 对 `revise`，列出它要返回完整 `Record` 必须提供的三个字段各自来源。若实现只取走 `title` 与 `prefix` 后就想返回原 `record`，指出错误。
3. 为第二个接口给出一份无克隆的字段流转设计，并说明为什么 `Record` 不能添加 `Drop` 实现后再从字段部分移动。

**契约：** 答案分别说明调用把 owner 移入参数，`u32` 可复制读取，`String` 字段移动后不可再次读取；`take_title` 必须消费或处置 body；`revise` 必须重建并返回完整结构体；实现 `Drop` 与字段部分移动不兼容。

**分层提示：** ① 按值传参后，原调用绑定是否仍是 owner？② 按字段画箭头，尤其关注 `body`。③ 新 `Record` 返回前，逐项核对 `id`、`title`、`body`。

## 4. 边界迁移：部分移动后还能使用什么

画出三个字段的所有权变化，预测 `split_ticket` 与 `update_body` 的返回值；验证两项测试，再编译反例观察 E0382。尝试保留 `priority` 并修改正文后重组 `Ticket`，不允许通过全对象 `clone` 掩盖设计问题。

**验收：** 执行 `cargo +1.95.0 test --offline --manifest-path content/samples/verified-lesson-drills/Cargo.toml m04_partial::`、记录正例与反例的具体观察，并说明采用这个修复而非隐藏错误的原因。

## 参考答案

1. 修复版先移动并打印 `subject`，再将仍有效的 `note.body` 移入局部绑定并返回。删除对 `note.subject` 的再次读取。调用方不能再使用原 `note`，因为它已作为参数移入函数，且其两个 `String` 字段分别被移动。
2. 实现可写为：

   ```rust
   fn take_payload(packet: Packet) -> String {
       let label = packet.label;
       println!("label: {label}");
       packet.payload
   }
   ```

   `label` 被移动到局部绑定并打印；`payload` 是返回表达式，owner 交给调用方。输出依次为 `label: report`、`payload: complete`。
3. `take_title` 接管整个 `Record`；`id` 可复制读取，`title` 移动到返回值，`body` 必须在函数结束前消费或让它自动销毁。`revise` 可复制 `id`，用 `prefix` 和旧 `title` 构造新标题，再把 `body` 移入新的完整 `Record`。`Record` 若实现 `Drop`，就不能从它的字段部分移动。

   ```rust
   fn take_title(record: Record) -> String {
       let _id = record.id;
       let title = record.title;
       drop(record.body);
       title
   }

   fn revise(record: Record, prefix: String) -> Record {
       let id = record.id;
       let title = format!("{prefix}{}", record.title);
       Record {
           id,
           title,
           body: record.body,
       }
   }
   ```

## 来源

- [The Rust Programming Language：What Is Ownership?](https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html)
- [The Rust Reference：Destructors](https://doc.rust-lang.org/reference/destructors.html)
