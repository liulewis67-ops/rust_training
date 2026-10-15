# M09-L01 练习：Result、? 与错误传播

## 1. 预测：错误会在哪一层被观察到？

~~~rust
use std::num::ParseIntError;

/// Parses one unsigned value and triples it.
fn triple(input: &str) -> Result<u32, ParseIntError> {
    let value = input.parse::<u32>()?;
    Ok(value * 3)
}

/// Checks and prints the caller-visible result variants.
fn main() {
    println!("{:?}", triple("4"));
    println!("{:?}", triple("four"));
}
~~~

预测两次调用分别输出什么变体？第二次出错时，? 会 panic、返回默认值，还是从 triple 提前返回？调用 triple 的 main 能否看到该错误？

**提示**：沿着 ? 所在函数追踪返回值，再追踪调用方是否检查或打印了它。

**验证契约**：输出分别是 Ok(12) 与 Err(...)；错误保留在 Result 并回到调用方，没有被吞掉，也没有在 triple 中 panic。

## 2. 修复：返回类型不兼容

下面的函数意图返回解析后的值，当前却把 Result 上的 ? 放进 Option 返回函数。修复接口和实现，让有效输入返回 Ok(Some(...))、无效输入仍保留原始 ParseIntError，并通过断言验证两条路径。

~~~rust
/// Attempts to parse optional text but uses an incompatible error channel.
fn parse_optional(input: &str) -> Option<u32> {
    let value = input.parse::<u32>()?;
    Some(value)
}

/// Checks both parse outcomes.
fn main() {
    assert_eq!(parse_optional("8"), Some(8));
    assert!(parse_optional("eight").is_none());
}
~~~

**提示**：? 必须能从当前函数返回其错误；把签名改成 Result<Option<u32>, ParseIntError>。这里 parse 成功就有一个值，所以返回 Ok(Some(value))；不要用 .ok() 丢掉具体错误。

**验证契约**：修复前因 ParseIntError 不能从返回类型 Option<_> 提前返回而无法编译；修复后 "8" 返回 Ok(Some(8))，非法输入返回 Err(ParseIntError)，其错误类型没有被抹除。

## 3. 实现：安全传播比例解析错误

实现 scale_by_factor：解析输入为 u32 并乘以给定系数。返回 Result；若文本无效，原始 ParseIntError 必须传给调用方。题目测试中的数值保证乘法不溢出。

~~~rust
use std::num::ParseIntError;

/// Parses an unsigned value and scales it by the caller's factor.
fn scale_by_factor(_input: &str, _factor: u32) -> Result<u32, ParseIntError> {
    // TODO: Parse with ?, then return the scaled value in Ok.
    todo!()
}

/// Checks success, propagation, and continued caller control.
fn main() {
    assert_eq!(scale_by_factor(" 6 ", 4), Ok(24));
    assert!(matches!(scale_by_factor("six", 4), Err(_)));
    assert_eq!(scale_by_factor("2", 4), Ok(8));
}
~~~

**提示**：先 trim() 再 parse::<u32>()?；? 取出 Ok 内的数字。最后返回 Ok(value * factor)。

**验证契约**：空白首尾可接受；成功路径返回正确乘积；解析失败时函数不 panic、不回传假零值，而是返回 Err。调用方在获得 Err 后仍可继续执行自己的后续逻辑。
