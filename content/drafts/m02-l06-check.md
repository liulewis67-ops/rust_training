# M02-L06：独立检查——带边界处理的合计函数

本检查用于确认你能独立完成一个带数值边界的计算函数。提交前不要打开教师侧评分参考；平台的独立技能证据只记录未查看答案时提交的代码版本。

## 任务

实现下面的函数，返回两个非负数量的合计：

```rust
/// Adds two quantities when their sum is representable as u32.
pub fn checked_total(base: u32, adjustment: u32) -> Result<u32, &'static str> {
    // Implement the contract without panicking.
    todo!()
}
```

## 契约

- 对所有 `base` 和 `adjustment`，若数学上的和可由 `u32` 表示，返回 `Ok(精确和)`。
- 若数学上的和大于 `u32::MAX`，返回 `Err`；不能 panic、回绕或饱和到最大值。
- 函数不得只识别给出的例子；隐藏检查会使用未展示的普通值、交换顺序的值和边界附近的值。

以下是公开契约点，不是完整测试集：`0 + 0` 得到 `Ok(0)`；`17 + 25` 得到 `Ok(42)`；`u32::MAX + 0` 与 `(u32::MAX - 1) + 1` 都得到最大可表示值；`u32::MAX + 1` 返回 `Err`。

## 提交

提交 Rust 源码及简短说明：成功路径如何保留精确值，溢出路径为何满足契约。平台会先编译，再运行公开与未公开边界测试；任何 panic、回绕、饱和替代或硬编码样例都不能通过相应门槛。

## 反馈

失败反馈会区分编译/签名问题、普通算术结果、边界结果和溢出行为，并给出下一步检查提示。完成首次独立提交后可以查看分层提示或参考解继续练习；查看答案后的后续提交用于学习，不覆盖首次独立证据。

## 来源

- [Rust 标准库：`u32::checked_add`](https://doc.rust-lang.org/std/primitive.u32.html#method.checked_add)

来源链接用于核对整数加法溢出检查 API；题目和测试为原创。
