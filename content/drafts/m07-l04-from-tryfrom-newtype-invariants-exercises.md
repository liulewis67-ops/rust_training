# M07-L04 练习：From/TryFrom、newtype 与不变量

## 1. 修复：拒绝静默截断

```rust
struct RetryCount(u8);

impl From<u32> for RetryCount {
    fn from(value: u32) -> Self {
        Self(value as u8)
    }
}
```

重试范围为 `0..=5`。改写该转换，让有效值构造 `RetryCount`，超范围值返回明确错误；并说明为何必须移除 `From<u32>` 实现，不能只在其旁边添加 `TryFrom<u32>`。

**提示**：`From<u32> for RetryCount` 自动提供 `u32: Into<RetryCount>`；标准库也因此提供相应的 infallible `TryFrom` blanket implementation。先撤掉承诺总能成功的转换，再为同一源/目标类型实现 fallible conversion。

**验证契约**：`3` 成功成为 `RetryCount(3)`；`6` 返回包含原始值的错误；`256` 也必须报错，不能先转换成 `u8` 后变成 `0`。原 `as u8` 版本应被识别为错误实现。

## 2. 实现：受限端口类型

创建字段私有的 `ServicePort(u16)`，通过 `TryFrom<u32>` 仅接受 `1..=65535`，定义能保留非法输入值的错误类型。验证 `1`、`65535` 成功，`0` 和 `65536` 失败。实现或写出只读访问方式，证明调用方无法直接构造 `ServicePort(0)`。

**提示**：先在 `u32` 输入上检查边界，再转换成 `u16`；不要用 `as` 提前丢弃高位。此转换可能失败，所以不能实现为 `From<u32>`。

**验证契约**：所有有效边界通过，两个非法边界携带原值失败；正确 API 不公开 tuple 字段且没有 panic 或截断。

## 3. 设计评审：哪些转换是全定义的？

评审三个提案：

1. `From<u64> for AccountId`，所有 `u64` 都是本系统合法账户 ID。
2. `From<String> for NonEmptyName`，输入为空时 panic，否则保存原字符串。
3. `TryFrom<String> for NonEmptyName`，空白输入返回 `EmptyName`，有效文本去除首尾空白后保存。

逐项判断转换 trait 是否符合语义、调用方如何处理失败，以及何时应使用私有字段。提出对 2、3 的修复或取舍。

**提示**：区分“每个值都能转换”和“只有满足条件的值才能转换”；From 不能以 panic 假装 infallible。

**验证契约**：评审认定 1 可用 From；2 违反 From 的 infallible 约定，应改 TryFrom；3 合理，但要说明规范化和保留原始输入之间的产品选择。newtype 字段保持私有，使绕过验证的构造不可用。
