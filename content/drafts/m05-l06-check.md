# M05-L06：独立检查——借用冲突与 UTF-8 安全分割

本检查评估你能否在陌生场景中同时处理共享借用冲突和 UTF-8 字符串切片。请先独立提交实现、修复和说明；首次提交前不要打开教师评分参考。

## 任务 A：安全分割并返回原始切片

补全 split_label。按 separator 的第一次出现把 text 分成左右两片；不包括分隔符本身。separator 为空或不存在时返回 None。

~~~rust
/// Splits text around its first non-empty separator and borrows both pieces.
pub fn split_label<'text>(
    text: &'text str,
    separator: &str,
) -> Option<(&'text str, &'text str)> {
    // TODO: Find a byte offset, then safely return both original slices.
    todo!()
}
~~~

匹配及边界必须来自实际输入。不得硬编码样例输出，不得把字节偏移当字符数，也不得返回新分配的字符串或使用 unsafe。

## 任务 B：修复调用点的借用冲突

下面的调用端借用 label 中的两段文本后立刻修改 owner，并在修改后再使用借用切片。请调整数据使用顺序，使所有业务步骤保留且代码可编译：

~~~rust
fn main() {
    let mut label = String::from("部署：完成");
    let (kind, value) = split_label(&label, "：").unwrap();
    label.push('!');
    println!("parts: {kind} / {value}");
    println!("updated: {label}");
}
~~~

原顺序因 E0502 失败。修复版输出必须依次为 parts: 部署 / 完成、updated: 部署：完成!。保留安全分割、两段读取、修改和两行输出。

## 输入检查点

- ASCII：split_label("head::tail", "::") 返回 ("head", "tail")。
- 多字节分隔符：split_label("部署：完成", "：") 返回 ("部署", "完成")。
- 多字节字符分隔符：split_label("东🧭西", "🧭") 返回 ("东", "西")。
- 首次匹配：split_label("a::b::c", "::") 返回 ("a", "b::c")。
- 分隔符为空、不存在，或输入为空时返回 None。
- 非空结果必须分别指向 text 中分隔符之前和之后的原始字节区间。

## 提交说明

解释 find 给出的偏移为何适用于该匹配位置，get 如何避免无效 UTF-8 边界切片；说明两段切片何时仍借用 label，以及为什么要先完成读取再追加字符。

检查会对未公开输入做变式测试。只针对示例硬编码答案、把多字节字符按一个字节递增、删除读取/修改步骤或以无关编译错误回避任务，均不算完成。

首次独立提交记录完成后，可查看分层反馈并重试；答案打开后的提交不能覆盖首次独立技能证据。

## 来源

- [The Rust Programming Language：The Slice Type](https://doc.rust-lang.org/book/ch04-03-slices.html)
- [Rust standard library：str::find](https://doc.rust-lang.org/std/primitive.str.html#method.find)
- [Rust standard library：str::get and string slicing](https://doc.rust-lang.org/std/primitive.str.html)

检查契约、边界用例和反馈目标为原创；来源用于核对 find 返回字节偏移以及 UTF-8 切片边界规则。
