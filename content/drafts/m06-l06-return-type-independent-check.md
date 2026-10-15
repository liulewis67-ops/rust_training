# M06-L06：独立检查——为结果选择借用、String 或 Cow

本检查用一个陌生的主题标签任务，评估你能否选择适合调用方持有边界的返回类型。先提交实现与设计说明；首次提交前不要打开教师评分参考。

## 任务 A：条件规范化并保留来源

补全 `normalize_topic`：

- 若输入已经以一个 `#` 开头，返回去掉第一个 `#` 后的原始子切片；结果必须借用输入，不复制文本。
- 若输入没有 `#`，在结果前加一个 `#` 并返回拥有型文本。
- 空输入结果为 `#`；多个开头 `#` 只去掉第一个。

```rust
use std::borrow::Cow;

pub fn normalize_topic<'input>(topic: &'input str) -> Cow<'input, str> {
    // TODO: Borrow an already-normalized suffix; own text only when adding '#'.
    todo!()
}
```

根据实际分支返回 `Cow::Borrowed` 或 `Cow::Owned`。不得硬编码样例、泄漏字符串、把局部引用标为 `'static`，或在未变化的输入上分配新 String。

## 任务 B：完成行为与来源检查

补全测试，至少覆盖：普通输入需要添加前缀、已有前缀、空输入、两个前缀、UTF-8 标签内容，以及 Borrowed 分支的返回切片确实来自原输入。

```rust
#[test]
fn normalize_topic_contract() {
    // TODO: Assert exact values and Cow ownership variants.
}
```

输出契约：`"rust" → "#rust"`、`"#rust" → "rust"`、`"" → "#"`、`"##rust" → "#rust"`、`"#你好" → "你好"`。无前缀分支为 Owned；已有前缀分支为 Borrowed，并且结果地址落在输入范围内。

## 任务 C：说明三种 API 的边界

对以下调用需求分别选择返回类型，并说明输入 owner 是否必须继续保留、是否会复制文本：

1. 函数同步读取调用方的标题并返回其中一个子切片。
2. 任务队列要在调用输入销毁后继续保存完整消息。
3. 只有部分主题需要加前缀，未变化主题希望零复制返回。

应分别说明适合 `&str`/`&'a str`、`String` 和 `Cow<'a, str>` 的情况。解释 `Cow::into_owned` 对 Borrowed 与 Owned 分支的行为；不要把 `Cow` 当成总是无分配或总是拥有数据的保证。

## 提交说明

说明输入与输出生命周期关系、两个分支各自的拥有责任、来源范围断言的作用，以及你的 API 类型如何满足延迟保存需求。检查会使用未公开 UTF-8 标签变式。首次独立提交记录完成后可查看分层反馈并重试；打开答案后的提交不能覆盖首次技能证据。

## 来源

- [Rust standard library：Cow](https://doc.rust-lang.org/std/borrow/enum.Cow.html)
- [The Rust Programming Language：The Slice Type](https://doc.rust-lang.org/book/ch04-03-slices.html)
- [The Rust Reference：Lifetime bounds](https://doc.rust-lang.org/reference/trait-bounds.html#lifetime-bounds)

契约、测试和设计场景为原创；来源用于核对 Cow 的 Borrowed/Owned 变体、切片引用与生命周期约束。
