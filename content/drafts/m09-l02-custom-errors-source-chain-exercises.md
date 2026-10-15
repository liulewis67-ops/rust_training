# M09-L02 练习：自定义错误与来源链

## 1. 预测：摘要、输入位置和来源分别是什么？

使用正文中的 parse_port_field：

1. parse_port_field(12, Some("wide")) 的稳定外层 Display 是什么？
2. 它的 source() 是 None 还是 Some？source 可下转型成哪个类型？
3. parse_port_field(13, None) 有底层 source 吗？为什么？

**提示**：区分 ConfigError 的问题分类和 ParseIntError；行号来自哪个参数？

**验证契约**：第 1 项为 line 12: invalid port value；第 2 项为 Some(ParseIntError)；第 3 项为 None，因为缺字段是外层配置问题，没有调用数字解析器，也就没有被包装的解析错误。

## 2. 修复：错误存在，但来源链被丢弃

下面的类型保留了 ParseIntError 字段，也实现了稳定摘要，但 Error::source 总是返回 None。修复实现，让 source() 返回原始 cause；不得把 cause 拼到 Display 后再返回 None。

~~~rust
use std::error::Error;
use std::fmt;
use std::num::ParseIntError;

/// Wraps a parser failure with its source line.
#[derive(Debug)]
struct LocatedParseError {
    /// Stores the one-based line where parsing failed.
    line: usize,
    /// Retains the original standard-library parse error.
    cause: ParseIntError,
}

/// Shows stable context without flattening the nested source.
impl fmt::Display for LocatedParseError {
    /// Formats the line location and error category.
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "line {}: invalid integer", self.line)
    }
}

/// Implements Error but currently hides the wrapped cause.
impl Error for LocatedParseError {
    /// TODO: expose cause as the lower-level source.
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        None
    }
}

/// Checks that the source chain retains the parser error type.
fn main() {
    let cause = "oops".parse::<u16>().unwrap_err();
    let error = LocatedParseError { line: 5, cause };
    assert_eq!(error.to_string(), "line 5: invalid integer");
    assert!(
        Error::source(&error)
            .and_then(|source| source.downcast_ref::<ParseIntError>())
            .is_some()
    );
}
~~~

**提示**：在 source() 中借用 cause 并转换为 Error trait object。不要移动 cause，也不要返回 self，否则会让来源链循环。

**验证契约**：起始代码编译成功但断言失败；修复后 Display 保持不变，source() 可下转型为 ParseIntError。

## 3. 实现：为端口解析附加行号

实现 attach_line：成功值保持不变；失败时把传入行号和原始 ParseIntError 放入 LocatedParseError。不要转换成字符串。

~~~rust
use std::error::Error;
use std::fmt;
use std::num::ParseIntError;

/// Wraps a parser failure with its source line.
#[derive(Debug)]
struct LocatedParseError {
    /// Stores the one-based line where parsing failed.
    line: usize,
    /// Retains the original standard-library parse error.
    cause: ParseIntError,
}

/// Shows stable context without flattening the nested source.
impl fmt::Display for LocatedParseError {
    /// Formats the line location and error category.
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "line {}: invalid integer", self.line)
    }
}

/// Exposes the lower-level parser error.
impl Error for LocatedParseError {
    /// Returns the retained parse error as the source.
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        Some(&self.cause)
    }
}

/// Adds an input line to a parse result without changing the success value.
fn attach_line(
    line: usize,
    parsed: Result<u16, ParseIntError>,
) -> Result<u16, LocatedParseError> {
    // TODO: Keep Ok unchanged and wrap Err with line context.
    todo!()
}

/// Checks successful values and nested error context.
fn main() {
    assert!(matches!(attach_line(2, "8080".parse::<u16>()), Ok(8080)));

    let error = attach_line(9, "wide".parse::<u16>()).unwrap_err();
    assert_eq!(error.line, 9);
    assert_eq!(error.to_string(), "line 9: invalid integer");
    assert!(
        Error::source(&error)
            .and_then(|source| source.downcast_ref::<ParseIntError>())
            .is_some()
    );
}
~~~

**提示**：Result::map_err 只转换 Err；闭包中用 source 字段保存原始错误。

**验证契约**：正确实现保留 Ok(8080)，非法数字返回带行号的 LocatedParseError，source() 仍暴露 ParseIntError；不接受只返回错误字符串的实现。
