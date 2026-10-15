# M09-L04：panic、恢复策略与错误信息

## 学完后

- 区分可预期的业务失败与程序不变量被破坏：前者用 Result，后者才考虑 panic。
- 选择有上下文的恢复策略，不把 panic 捕获当作通用 try/catch。
- 分离给用户看的稳定消息与受控诊断信息，避免回显机密和内部路径。
- 解释 unwind、abort、catch_unwind 和 panic hook 的边界。

## 先修

完成 M09-L03，理解领域错误如何映射到 CLI/API。本节仍是私有预写内容，M09-L03 正式验收与共用门槛 C 尚未完成。

## 可恢复输入错误用 Result

用户把文本输入成非数字，是正常可预期的失败，不是程序不变量损坏。让解析函数返回 Err，由调用边界决定提示用户修正；不应因输入错误调用 unwrap、expect 或 panic：

~~~rust
use std::error::Error;
use std::fmt;
use std::io;
use std::num::ParseIntError;

/// Preserves expected input errors and unexpected storage failures.
#[derive(Debug)]
enum RequestError {
    /// The request supplied a limit that cannot be parsed as u16.
    InvalidLimit(ParseIntError),
    /// The request could not be completed because storage failed.
    Storage(io::Error),
}

/// Formats an internal description without selecting a user channel.
impl fmt::Display for RequestError {
    /// Writes a concise category description.
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidLimit(_) => write!(formatter, "invalid limit"),
            Self::Storage(_) => write!(formatter, "storage operation failed"),
        }
    }
}

/// Exposes the lower-level failure to trusted diagnostic code.
impl Error for RequestError {
    /// Returns the original parser or storage cause.
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::InvalidLimit(source) => Some(source),
            Self::Storage(source) => Some(source),
        }
    }
}

/// Parses a user-provided limit and returns ordinary input errors.
fn parse_limit(raw: &str) -> Result<u16, RequestError> {
    let limit = raw.trim().parse::<u16>().map_err(RequestError::InvalidLimit)?;
    Ok(limit)
}

/// Chooses a stable message that is safe to show to a request user.
fn public_message(error: &RequestError) -> &'static str {
    match error {
        RequestError::InvalidLimit(_) => "limit must be an unsigned 16-bit integer",
        RequestError::Storage(_) => "request could not be completed",
    }
}

/// Gives each failure class a stable internal diagnostic category.
fn diagnostic_code(error: &RequestError) -> &'static str {
    match error {
        RequestError::InvalidLimit(_) => "invalid_limit",
        RequestError::Storage(_) => "storage_failure",
    }
}

/// Checks normal input failure, message separation, and an isolated panic boundary.
fn main() {
    let private_input = "not-a-number-secret";
    let invalid = parse_limit(private_input).unwrap_err();
    assert_eq!(public_message(&invalid), "limit must be an unsigned 16-bit integer");
    assert_eq!(diagnostic_code(&invalid), "invalid_limit");
    assert!(Error::source(&invalid).is_some());
    assert!(!public_message(&invalid).contains(private_input));

    let storage = RequestError::Storage(io::Error::new(
        io::ErrorKind::PermissionDenied,
        "private filesystem path",
    ));
    assert_eq!(public_message(&storage), "request could not be completed");
    assert_eq!(diagnostic_code(&storage), "storage_failure");
    assert!(Error::source(&storage).is_some());
    assert!(!public_message(&storage).contains("private filesystem path"));

    let isolated = std::panic::catch_unwind(|| {
        panic!("synthetic internal invariant failure");
    });
    assert!(isolated.is_err());
}
~~~

parse_limit 保留输入问题为 Err，调用方可以显示修正提示或继续传播。source() 使受控诊断仍能检查原始原因；公开消息只提供下一步有用的信息，不回显请求文本、文件路径或底层错误原文。

## panic 用于暴露程序缺陷，不代替业务错误

当内部状态违反“到这里一定满足”的不变量，panic 可以停止在错误状态上继续工作的路径。它不是一种方便返回的业务分支。不要把无效用户输入、缺失资源或常见 I/O 失败转换成 panic，再把所有 panic 捕获后假装正常恢复。

本例用 catch_unwind 展示一个受限的隔离边界：在 unwind 策略下它可以观察到闭包 panic。但标准库明确不建议把它当作通用 try/catch；panic=abort 时无法捕获，panic hook 会在捕获前运行，闭包还需满足 UnwindSafe。捕获后也必须证明共享状态仍可安全使用。普通输入和依赖失败应继续使用 Result。

若 panic 时 unwinding，Rust 会清理展开栈帧中的值；若配置为 abort，进程立即结束，不执行这种恢复。catch_unwind 不能把程序逻辑缺陷自动变成可恢复错误。

## 公共消息和诊断信息分开

- **公共消息**：稳定、简短、可行动；例如说明哪个输入字段无效，以及如何修正。
- **诊断上下文**：错误类别、source 链、请求 ID 和必要位置；写入访问受控的日志或诊断系统。
- **敏感内容**：令牌、口令、完整私有路径和未经筛选的请求体不要直接呈现给用户，也不要无节制写进一般日志。
- **panic hook/backtrace**：用于开发或受控故障诊断；不应把它当作面向用户的错误响应协议。
- **恢复决策**：输入无效通常让调用方修改后重试；临时依赖失败可以有界重试；不变量 panic 则应停止或隔离故障组件，而不是盲目重复请求。

## 分层提示

1. **失败性质提示**：这是调用者可以修正的输入，还是程序内部状态已经违反不变量？
2. **恢复位置提示**：哪一层有足够上下文决定重试、改输入、返回 API 错误或停止任务？
3. **泄漏提示**：消息是否包含原始输入、secret、路径或底层错误正文？这些内容会到达哪个通道？
4. **panic 提示**：捕获策略是 unwind 还是 abort？hook 是否仍运行？闭包状态在 panic 后是否安全？
5. **参考方案**：可预期错误以 Result 传递；API 给出稳定公开消息；受控诊断保留分类与来源；只在明确隔离边界考虑 catch_unwind。

## 来源

- [Rust Book：Unrecoverable Errors with panic!](https://doc.rust-lang.org/book/ch09-01-unrecoverable-errors-with-panic.html)
- [Rust 标准库：catch_unwind](https://doc.rust-lang.org/std/panic/fn.catch_unwind.html)
- [Rust 标准库：UnwindSafe](https://doc.rust-lang.org/std/panic/trait.UnwindSafe.html)

错误场景与安全消息为原创。官方来源用于核对 panic、unwind/abort、panic hook 和 catch_unwind 的限制。
