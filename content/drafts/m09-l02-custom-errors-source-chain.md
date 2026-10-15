# M09-L02：自定义错误与来源链

## 学完后

- 把稳定的应用含义和底层错误原因放进可匹配的自定义错误类型。
- 保留输入行号等上下文，不用把原因预先格式化成 String 来替代错误对象。
- 为错误实现 Debug、Display 与 std::error::Error。
- 用 Error::source 暴露被包装的底层错误；让显示消息和可追踪原因各司其职。

## 先修

完成 M09-L01，能读 Result、?、From 和提前返回。本稿是私有预写内容，M09-L01 正式验收与共用门槛 C 尚未完成。

## 错误值同时保留分类与上下文

配置端口字段可能缺失、为空，或不是合法的 u16。前三种情况都是可恢复输入错误，但只有第三种来自标准库解析器。让枚举承载稳定分类，外层结构记录行号；不要把所有情况合并成字符串：

~~~rust
use std::error::Error;
use std::fmt;
use std::num::ParseIntError;

/// Identifies the kind of problem found in a port field.
#[derive(Debug)]
enum PortProblem {
    /// The configuration line did not provide a port value.
    MissingValue,
    /// The provided value could not be parsed as a port number.
    InvalidNumber(ParseIntError),
}

/// Adds source location to a configuration parsing problem.
#[derive(Debug)]
struct ConfigError {
    /// Stores the one-based line number from the input.
    line: usize,
    /// Preserves the structured reason for the failure.
    problem: PortProblem,
}

/// Displays concise context without duplicating the wrapped parser message.
impl fmt::Display for ConfigError {
    /// Formats the location and stable category for a user-facing message.
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match &self.problem {
            PortProblem::MissingValue => {
                write!(formatter, "line {}: port value is missing", self.line)
            }
            PortProblem::InvalidNumber(_) => {
                write!(formatter, "line {}: invalid port value", self.line)
            }
        }
    }
}

/// Exposes a lower-level parse error for diagnostics and troubleshooting.
impl Error for ConfigError {
    /// Returns the parse error when one caused this configuration failure.
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match &self.problem {
            PortProblem::MissingValue => None,
            PortProblem::InvalidNumber(source) => Some(source),
        }
    }
}

/// Parses an optional port field while retaining its input line.
fn parse_port_field(line: usize, raw: Option<&str>) -> Result<u16, ConfigError> {
    let Some(raw) = raw else {
        return Err(ConfigError {
            line,
            problem: PortProblem::MissingValue,
        });
    };
    let raw = raw.trim();
    if raw.is_empty() {
        return Err(ConfigError {
            line,
            problem: PortProblem::MissingValue,
        });
    }

    match raw.parse::<u16>() {
        Ok(port) => Ok(port),
        Err(source) => Err(ConfigError {
            line,
            problem: PortProblem::InvalidNumber(source),
        }),
    }
}

/// Checks success, a context-only error, and a nested parse failure.
fn main() {
    assert_eq!(parse_port_field(2, Some(" 8080 ")).unwrap(), 8080);

    let missing = parse_port_field(4, None).unwrap_err();
    assert_eq!(missing.line, 4);
    assert_eq!(missing.to_string(), "line 4: port value is missing");
    assert!(Error::source(&missing).is_none());

    let invalid = parse_port_field(7, Some("wide")).unwrap_err();
    assert_eq!(invalid.line, 7);
    assert_eq!(invalid.to_string(), "line 7: invalid port value");
    let source = Error::source(&invalid).expect("parser error should be preserved");
    assert!(source.downcast_ref::<ParseIntError>().is_some());
}
~~~

外层 Display 给使用者可读且稳定的定位摘要；source() 留下 ParseIntError 给日志、诊断工具或更高层调用方检查。不要同时把底层错误完整写进 Display，又通过 source 暴露同一错误，否则常见错误报告器可能重复显示原因。也不要只存 source.to_string()：这样会失去错误类型和可下转型的原始原因。

## 输入位置要跟错误一起走

如果函数只接收解析文本，失败后就没有行号。把位置作为参数传进可能失败的边界，并在生成外层错误时保存它。若嵌套调用有多层上下文，各层只添加自己知道的信息，并通过 source() 接起来：

~~~text
ConfigError: line 7: invalid port value
└── ParseIntError: invalid digit
~~~

上图表达的是错误链的结构；底层 ParseIntError 的具体展示文字依 Rust 版本和错误种类而定，不应成为课程契约。可靠契约检查行号、稳定外层消息、source 是否存在以及底层类型，而不锁定实现相关的字符串。

## 类型与展示是两个不同问题

- 类型/变体供程序分支处理，例如 MissingValue 与 InvalidNumber。
- Display 说明对当前调用者有用的上下文，例如行号和字段名。
- Debug 用于开发诊断，不承诺是稳定用户界面。
- Error::source 返回下层原因；没有被包装的原因时返回 None。
- 输入位置不是根因，底层错误也通常不知道上层文件中的行号；包装错误把两者连接起来。

本节使用标准库实现，刻意不引入派生宏依赖。更大的公共错误层级、错误来源链策略和库/应用边界分别在后续单元展开。

## 分层提示

1. **分类提示**：调用方需要稳定判断哪些情况？将其建模为枚举变体，不要匹配 Display 文本。
2. **位置提示**：底层解析函数知道输入来自第几行吗？在哪层把行号添加到包装错误？
3. **来源提示**：包装错误持有哪些原始错误？Error::source 返回它，还是 Display 又复制了一遍？
4. **测试提示**：分别检查变体/位置、稳定外层 Display、source 是否存在和 source 的具体类型。
5. **参考路径**：外层错误保存行号与 issue；Display 输出简洁上下文；source 对被包装的 ParseIntError 返回 Some，对缺失字段返回 None。

## 来源

- [Rust Book：Recoverable Errors with Result](https://doc.rust-lang.org/book/ch09-02-recoverable-errors-with-result.html)
- [标准库：Error 与 source](https://doc.rust-lang.org/std/error/trait.Error.html)
- [标准库：Display](https://doc.rust-lang.org/std/fmt/trait.Display.html)

错误分类、配置场景和代码为原创；官方文档用于核对错误 trait 的展示与来源责任。
