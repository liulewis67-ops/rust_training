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

## 4. 边界迁移：先验证再缩窄的 TryFrom

先预测 `0, 1, 65535, 65536` 的转换结果，运行两项测试；在副本中把 `as u16` 放在边界验证之前，看 65536 如何变成 0。然后编译两种 newtype 混用的反例，解释类型不匹配与数值超范围是两个独立的错误。

**验收：** 执行 `cargo +1.95.0 test --offline --manifest-path content/samples/verified-lesson-drills/Cargo.toml m07_conversion::`，分别提交测试结果与反例诊断，并说明为何此方案保留了函数与调用方的原始契约。

## 参考答案

1. 移除 `From<u32> for RetryCount`，因为它承诺所有 `u32` 都能无失败转换，且会截断。改用错误类型保留原值：

   ```rust
   #[derive(Debug, PartialEq, Eq)]
   struct RetryCount(u8);
   #[derive(Debug, PartialEq, Eq)]
   struct RetryCountError(u32);

   impl TryFrom<u32> for RetryCount {
       type Error = RetryCountError;
       fn try_from(value: u32) -> Result<Self, Self::Error> {
           if value <= 5 {
               Ok(Self(u8::try_from(value).expect("0..=5 fits in u8")))
           } else {
               Err(RetryCountError(value))
           }
       }
   }
   ```

2. 字段保持私有，并在检查后构造：

   ```rust
   struct ServicePort(u16);
   #[derive(Debug, PartialEq, Eq)]
   struct InvalidServicePort(u32);

   impl TryFrom<u32> for ServicePort {
       type Error = InvalidServicePort;
       fn try_from(value: u32) -> Result<Self, Self::Error> {
           if (1..=65_535).contains(&value) {
               Ok(Self(u16::try_from(value).expect("validated u16 range")))
           } else {
               Err(InvalidServicePort(value))
           }
       }
   }
   ```

   可提供 `fn get(&self) -> u16` 只读访问器；模块外无法直接构造 `ServicePort(0)`。
3. 第一项 `From<u64>` 表达总能完成的无损包装，适合该前提。第二项的 `From<String>` 会对空输入 panic，违反无失败约定，应移除并改成返回 `Result` 的 `TryFrom`。第三项的 `TryFrom` 明确处理空白失败；trim 后保存意味着规范化且不保留周边空白，若产品需保留原文则应调整契约。私有字段使调用方必须经过验证入口。