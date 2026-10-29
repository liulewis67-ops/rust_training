# M06-L02 练习：函数生命周期标注与省略

## 1. 预测：签名展开后会打印什么？

```rust
fn echo(text: &str) -> &str {
    text
}

fn main() {
    let message = String::from("job ready");
    let view = echo(&message);
    println!("{view} / {}", message.len());
}
```

预测能否编译及输出；把 `echo` 的签名写成显式生命周期版本，并指出输出借自什么。

**提示**：函数有一个输入引用，适用单一输入来源规则。

**验证契约**：编译输出 `job ready / 9`；显式签名为 `fn echo<'text>(text: &'text str) -> &'text str` 或等价写法；说明 `String` owner 仍由调用方持有。

## 2. 修复：消除两个输入的输出歧义

修复 `pick_left_or_right` 的输出生命周期歧义：当 `choose_left` 为真时返回 `left`，否则返回 `right`。两项输入均由调用方提供，必须保留零复制行为。

```rust
fn pick_left_or_right(left: &str, right: &str, choose_left: bool) -> &str {
    if choose_left { left } else { right }
}
```

**提示**：实现会返回任意一个输入。输出有效的区间必须同时覆盖当前可能被选中的两个输入。

**验证契约**：修复后的签名可形如 `fn pick_left_or_right<'text>(left: &'text str, right: &'text str, choose_left: bool) -> &'text str`，分别验证左右分支。错误解不能通过新增 `String` 复制文本。

## 3. 实现：借用文本输入，查询仅作筛选

实现 `find_fragment`：在 `text` 中查找与 `query` 完全相同的 Unicode 空白分隔 token，命中返回输入中的原始 token，缺失返回 `None`。输出必须借用 `text`，而不是 `query`。

```rust
fn find_fragment(text: &str, query: &str) -> Option<&str> {
    // TODO: Return the matching token as a slice of text.
    todo!()
}
```

**提示**：让输出生命周期和 `text` 关联；`query` 只参与比较。可以直接遍历 `split_whitespace()`，不必复制字符串。

**验证契约**：覆盖普通命中、Unicode 空白分隔、查询本身是输入子串但非完整 token、缺失和空白输入。命中结果必须是 `text` 的原始子切片；不可硬编码、返回 `query`、分配新 String 或收集临时集合。

解释单一输入为何允许省略、多个来源何时需要显式标注、函数实现不决定输入 owner 的寿命这三者之间的关系。

## 4. 可复现实验：引用来源与 E0106

运行查询字符串先销毁而文本仍有效的测试，解释为何输出没有悬垂。编译两个引用来源的错误签名并记录 E0106；对比只允许返回 left 与确实可能返回任一输入的两种修复，说明生命周期参数是约束关系而非延长资源。

从仓库根目录运行 `node scripts/verify-lesson-drills.mjs`，统一核对正例与预期编译失败的诊断。

## 参考答案

1. 输出 `job ready / 9`。签名展开为 `fn echo<'text>(text: &'text str) -> &'text str`；返回值借自 `message`，owner 仍属于调用方。
2. 为两项输入和输出使用共同的有效区间：

   ```rust
   fn pick_left_or_right<'text>(
       left: &'text str,
       right: &'text str,
       choose_left: bool,
   ) -> &'text str {
       if choose_left { left } else { right }
   }
   ```

3. 将输出与 `text` 明确关联：

   ```rust
   fn find_fragment<'text>(text: &'text str, query: &str) -> Option<&'text str> {
       text.split_whitespace().find(|token| *token == query)
   }
   ```

   `query` 只参与比较；命中 token 是 `text` 的原始子切片。仅一个输入引用时输出可依省略规则关联它；多个可能来源时应显式表达输出关系。标注不会延长任何输入 owner 的寿命。