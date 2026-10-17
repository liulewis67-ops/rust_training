# M07-L02 练习：trait、impl 与关联类型

## 1. 预测：两个实现的关联输出

阅读正文中的 `Summary`、`QueueItem` 和 `ImportBatch` 实现。预测 `render_summary` 对两种值的结果，并分别写出 `QueueItem::Output` 与 `ImportBatch::Output` 的具体类型。说明为什么 `render_summary<T: Summary>` 不必为这两种类型各写一份。

**提示**：先从 `impl Summary for Type` 找实现类型，再查看该 impl 里的 `type Output = ...`。

**验证契约**：Rust 1.95.0、Edition 2024 编译运行；结果分别是 `Q17 (retries: 2)` 和 `8`。解释必须说明泛型函数依赖 trait 行为，输出类型通过关联类型选择。

## 2. 修复：实现必须遵守 trait 签名

```rust
trait Label {
    type Text: std::fmt::Display;
    fn label(&self) -> Self::Text;
}

struct RetryCount(u8);

impl Label for RetryCount {
    type Text = String;

    fn label(&self) -> u8 {
        self.0
    }
}
```

修复 `RetryCount` 的实现，使 `Text = String`，并返回 `retry=N`。然后再从另一份副本中删去 `label` 方法，观察缺少必需项的诊断。分别解释两种失败对应契约的哪一部分。

**提示**：方法返回值必须与 `Self::Text` 一致。第二种变体不缺关联类型，只缺方法。

**验证契约**：修复后的实现能显示 `retry=3`。原返回类型不匹配版本编译失败并指出 trait 签名不一致；删掉方法的版本编译失败并指出未实现必需项。具体错误编号可随编译器版本变化。

## 3. 实现：为导入批次增加摘要

定义 `ImportedBatch { accepted: u32 }`，为它实现正文中的 `Summary` trait。选择 `u32` 作为 `Output`，摘要值为 `accepted`。编写泛型 `render_summary`，对 `QueueItem` 与 `ImportedBatch` 都可调用，并添加断言。

**提示**：在 trait impl 内声明 `type Output = u32;`。泛型调用函数需要 `T: Summary`；格式化输出则由关联类型上的 Display bound 保证。

**验证契约**：`render_summary(&ImportedBatch { accepted: 11 }) == "11"`；`QueueItem` 结果保持原摘要字符串。用一份正确实现和一份故意缺少 `summarize` 方法的错误变体验证；正确版本运行通过，错误版本编译失败。

## 参考答案

1. `QueueItem::Output` 是 `String`，`ImportBatch::Output` 是 `u32`；结果分别为 `Q17 (retries: 2)` 和 `8`。`render_summary<T: Summary>` 只调用 trait 声明的行为，并通过 `Self::Output: Display` 格式化结果。
2. 保持 `type Text = String`，将方法签名改为 `fn label(&self) -> Self::Text`，函数体返回 `format!("retry={}", self.0)`。另一个变体即使关联类型正确，仍因缺少必需方法而不满足 `Label`。
3. 实现示例：

   ```rust
   struct ImportedBatch { accepted: u32 }

   impl Summary for ImportedBatch {
       type Output = u32;
       fn summarize(&self) -> Self::Output { self.accepted }
   }

   fn render_summary<T: Summary>(value: &T) -> String {
       value.summarize().to_string()
   }
   ```

   对 `ImportedBatch { accepted: 11 }` 的结果是 `"11"`；`QueueItem` 仍使用原有 `String` 摘要。