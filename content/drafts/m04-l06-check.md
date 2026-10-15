# M04-L06：独立检查——审计并交付支持工单

本检查评估你能否按数据需求选择借用或移动，并解释每次操作后 owner 在哪里。请先提交实现和说明；首次独立提交之前不要打开教师侧评分参考。

## 任务

实现 `publish_ticket`。它收到一条 owned 工单文本，先计算原文本的 UTF-8 字节数，再将内容格式化为待发布工单并返回两项结果：

```rust
/// Returns the original UTF-8 byte count and the rendered ticket.
pub fn publish_ticket(source: String) -> (usize, String) {
    // TODO: Inspect the text without consuming it, then move it into render_ticket.
    todo!()
}

/// Consumes a ticket body and returns its rendered form.
fn render_ticket(body: String) -> String {
    format!("[ticket] {body}")
}
```

提交实现及简短说明，逐句描述 `source` 在计算字节数和传入 `render_ticket` 时的所有权状态。

## 契约

- `publish_ticket(String)` 返回 `(原始 UTF-8 字节数, "[ticket] " + 原文本)`。
- 只为读取长度时使用共享借用；将文本交给 `render_ticket` 时移动所有权。
- 借用检查必须先完成，随后才移动 `source`；不能在移动后再次读取它。
- 输入 `"build"` 返回 `(5, "[ticket] build")`；输入 `"é"` 的长度为 2 个 UTF-8 字节，返回 `(2, "[ticket] é")`。
- 两项结果都必须来自传入数据；不能硬编码公开样例、漏掉格式化、用 `0` 代替长度或改公开签名。
- 代码必须编译，不使用 `unsafe` 或第三方 crate。

## 公开检查点

公开检查核对 `"build"`、空字符串和一条非 ASCII 输入的字节数及完整格式化结果。检查用例仅供解释输出格式，不是完整的隐藏测试集。

## 技能说明

解释为什么长度查询适合借用，而格式化阶段接收 `String` 并消费其 owner；指出对同一字符串先借用后移动的顺序。不要把 `String::len()` 描述为 Unicode 字符数，它返回 UTF-8 字节数。

平台首次独立提交前隐藏教师评分参考。答案打开后的重试可用于学习，不能覆盖首次提交的独立记录。

## 来源

- [The Rust Programming Language：What Is Ownership?](https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html)
- [Rust standard library：`str::len`](https://doc.rust-lang.org/std/primitive.str.html#method.len)

工单契约、样例与技能说明为原创；来源用于核对借用/移动概念与 UTF-8 字节长度语义。
