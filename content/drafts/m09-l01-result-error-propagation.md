# M09-L01：Result、? 与错误传播

## 学完后

- 读懂 Result<T, E> 的 Ok 成功值和 Err 错误值。
- 用 match 在当前层分别处理成功与失败，或把错误传播给调用方。
- 用 ? 取出 Ok 值，并在 Err 时从当前函数提前返回。
- 说明 ? 的错误类型转换要求；传播错误不等于丢弃或忽略错误。

## 先修

本节依赖 M08-L06 的独立统计检查，概念上需会读枚举、函数返回类型和 match。本稿仍是私有预写内容；上游课程、R2 与独立学习者验收尚未完成。

## Result 把成功和失败都放在返回值里

一个可能失败的解析函数可以返回 Result<u32, ParseIntError>。调用方必须决定如何响应；这里分别检查成功值和错误分支：

~~~rust
use std::num::ParseIntError;

/// Parses a count and preserves the standard integer parsing error.
fn parse_count(input: &str) -> Result<u32, ParseIntError> {
    input.trim().parse::<u32>()
}

/// Handles both successful and failed parsing results.
fn main() {
    match parse_count("18") {
        Ok(count) => assert_eq!(count, 18),
        Err(error) => panic!("valid fixture failed to parse: {error}"),
    }

    match parse_count("many") {
        Ok(count) => panic!("invalid fixture unexpectedly parsed as {count}"),
        Err(error) => assert!(!error.to_string().is_empty()),
    }
}
~~~

在真实应用里，调用方通常会把错误展示给用户、记入诊断、选择备用操作，或继续向更高层返回。上例只用 panic! 让有效测试夹具失败时尽快暴露问题；它不建议把外部输入错误都改成 panic。

## 用 ? 提前返回，而不是吞掉错误

下面的函数在解析成功后继续缩放；若解析失败，? 会从 scale_count 返回 Err，调用方仍能观察到失败：

~~~rust
use std::num::ParseIntError;

/// Parses a count and scales it, forwarding parse failures to the caller.
fn scale_count(input: &str) -> Result<u32, ParseIntError> {
    let count = input.trim().parse::<u32>()?;
    Ok(count * 3)
}

/// Checks the success value and confirms invalid text remains an error.
fn main() {
    assert_eq!(scale_count("7"), Ok(21));
    assert!(matches!(scale_count("seven"), Err(_)));
}
~~~

在 Result 语境中，? 对 Ok(value) 产生 value 并继续；对 Err(error) 从当前函数提前返回错误。等价的基础控制流可写作 match，成功臂取出值，失败臂 return Err(error)。因此 ? 是缩写，不是忽略错误、返回默认值或自动恢复。

## 错误转换由目标返回类型决定

使用 ? 的函数必须有兼容的提前返回类型。若被 ? 的结果是 Result<T, E_source>，当前函数返回 Result<U, E_target> 时，错误需要能从 E_source 转为 E_target（通常通过 From<E_source> for E_target）。同类型传播满足这个条件；多个错误来源也可以由一个更宽的错误类型接收。

本例只展示转换接缝：空文本保留为自己的业务分支，整数解析失败经 From<ParseIntError> 变成 InputError::InvalidNumber。它尚未设计完整的公共错误层级或 source chain，后续 M09-L02 会专门处理：

~~~rust
use std::num::ParseIntError;

/// Distinguishes blank input from malformed integer text.
#[derive(Debug)]
enum InputError {
    /// The caller supplied no count text.
    Empty,
    /// Standard integer parsing rejected the supplied text.
    InvalidNumber(ParseIntError),
}

/// Converts the standard parser error into this function's error type.
impl From<ParseIntError> for InputError {
    /// Preserves the original parse error inside the domain variant.
    fn from(error: ParseIntError) -> Self {
        Self::InvalidNumber(error)
    }
}

/// Parses a non-empty count and propagates conversion failures.
fn parse_nonempty_count(input: &str) -> Result<u32, InputError> {
    let input = input.trim();
    if input.is_empty() {
        return Err(InputError::Empty);
    }

    let count = input.parse::<u32>()?;
    Ok(count)
}

/// Checks success, blank input, and converted parse failure separately.
fn main() {
    assert!(matches!(parse_nonempty_count("9"), Ok(9)));
    assert!(matches!(parse_nonempty_count("  "), Err(InputError::Empty)));
    match parse_nonempty_count("nine") {
        Err(InputError::InvalidNumber(error)) => {
            assert!(!error.to_string().is_empty());
        }
        other => panic!("expected converted parse error, got {other:?}"),
    }
}
~~~

若没有实现所需转换，编译器会拒绝 ?，因为当前函数无法返回该错误。此时应明确设计返回错误类型并实现转换，或用 map_err 显式映射；不要用 .ok()、unwrap_or(...) 或忽略 Err 来掩盖契约。何时局部处理、何时传播，取决于当前函数是否拥有足够上下文作出正确决定。

## 选择 match 还是 ?

- 当前层需要恢复、替代值或不同分支行为时，用 match / if let 处理 Ok 与 Err。
- 当前层无法作出有根据的恢复决定、但可把失败交给调用方时，用 ? 传播。
- 最外层仍要呈现最终失败；传播只把责任交给更了解上下文的调用方。
- Result 可能被显式忽略，但那不是处理成功；对关键操作应检查返回值或将它继续传播。

## 分层提示

1. **分支提示**：Ok 和 Err 各自携带什么类型？调用者下一步需要什么信息？
2. **传播提示**：? 放在谁的函数体内？那个函数的返回类型能否表达提前失败？
3. **转换提示**：被 ? 的错误类型与当前函数 Err 类型是否相同？若不同，哪条 From 转换负责连接它们？
4. **保真提示**：修复时是否仍能区分无效整数和空输入？不要用默认成功值或 .ok() 抹掉失败。
5. **参考路径**：保留 Result，使成功分支继续计算，失败分支由 ? 返回；在调用方分别断言有效与无效输入。

## 来源

- [The Rust Programming Language：Recoverable Errors with Result](https://doc.rust-lang.org/book/ch09-02-recoverable-errors-with-result.html)
- [The Rust Reference：Operator expressions (?)](https://doc.rust-lang.org/reference/expressions/operator-expr.html#the-question-mark-operator)
- [标准库：From](https://doc.rust-lang.org/std/convert/trait.From.html)

课程叙述、数据和练习为原创；官方资料用于核对 Result 分支、提前返回及错误转换语义。
