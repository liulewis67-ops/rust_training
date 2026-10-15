# M09-L03：库错误和应用错误边界

## 学完后

- 让业务库返回稳定、可检查的领域错误，而不是 CLI 文案、退出码或 HTTP 状态码。
- 在 CLI 边界把同一库错误映射为本地用户消息和退出码。
- 在 API 边界把业务错误映射为适当的 HTTP 状态与公开响应。
- 区分用户错误、缺失资源和内部故障；内部原因可诊断但不泄漏给远端调用者。

## 先修

完成 M09-L02，能设计结构化错误并保留 Error::source。此稿仍为私有预写内容；M09-L02 正式验收、R2 与共用门槛 C 尚未完成。

## 库层只表达领域事实

库层不应知道调用者会把错误写到终端还是编码成 HTTP 响应。它返回语义稳定的错误类型，保留底层 I/O 原因；应用层再决定展示方式：

~~~rust
use std::error::Error;
use std::fmt;
use std::io;

/// Describes failures in the profile and port domain.
#[derive(Debug)]
enum CoreError {
    /// The supplied port value did not satisfy the domain rules.
    InvalidPort { line: usize },
    /// The requested profile does not exist.
    ProfileNotFound { name: String },
    /// Storage failed while the library was performing an operation.
    Storage(io::Error),
}

/// Adds storage errors to the library error vocabulary.
impl From<io::Error> for CoreError {
    /// Preserves the concrete I/O error for diagnostics.
    fn from(source: io::Error) -> Self {
        Self::Storage(source)
    }
}

/// Provides a concise library-level description.
impl fmt::Display for CoreError {
    /// Formats the domain context without choosing a CLI or HTTP presentation.
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidPort { line } => write!(formatter, "invalid port at line {line}"),
            Self::ProfileNotFound { name } => write!(formatter, "profile {name:?} not found"),
            Self::Storage(_) => write!(formatter, "storage operation failed"),
        }
    }
}

/// Exposes an underlying storage failure to trusted diagnostics.
impl Error for CoreError {
    /// Returns a source only when a lower-level storage error exists.
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Storage(source) => Some(source),
            Self::InvalidPort { .. } | Self::ProfileNotFound { .. } => None,
        }
    }
}

/// Stores a local process exit code and stderr message.
#[derive(Debug, PartialEq, Eq)]
struct CliFailure {
    /// Uses the application-defined command-line exit contract.
    exit_code: i32,
    /// Contains the message intended for the local terminal.
    stderr: String,
}

/// Maps a library error to the CLI contract.
fn map_cli(error: &CoreError) -> CliFailure {
    match error {
        CoreError::InvalidPort { line } => CliFailure {
            exit_code: 2,
            stderr: format!("line {line}: invalid port; expected an unsigned 16-bit integer"),
        },
        CoreError::ProfileNotFound { name } => CliFailure {
            exit_code: 3,
            stderr: format!("profile {name:?} was not found"),
        },
        CoreError::Storage(source) => CliFailure {
            exit_code: 1,
            stderr: format!("storage failure: {source}"),
        },
    }
}

/// Stores a transport-neutral HTTP response projection.
#[derive(Debug, PartialEq, Eq)]
struct ApiFailure {
    /// Uses an HTTP status appropriate to the failure category.
    status: u16,
    /// Provides a stable machine-readable error code.
    code: &'static str,
    /// Provides a safe message for the remote client.
    message: &'static str,
}

/// Maps a library error to the API contract without leaking internals.
fn map_api(error: &CoreError) -> ApiFailure {
    match error {
        CoreError::InvalidPort { .. } => ApiFailure {
            status: 400,
            code: "invalid_port",
            message: "port must be an unsigned 16-bit integer",
        },
        CoreError::ProfileNotFound { .. } => ApiFailure {
            status: 404,
            code: "profile_not_found",
            message: "profile not found",
        },
        CoreError::Storage(_) => ApiFailure {
            status: 500,
            code: "internal_error",
            message: "internal server error",
        },
    }
}

/// Checks that the same domain errors map differently at each boundary.
fn main() {
    let invalid = CoreError::InvalidPort { line: 8 };
    assert_eq!(map_cli(&invalid).exit_code, 2);
    assert_eq!(map_api(&invalid).status, 400);

    let missing = CoreError::ProfileNotFound {
        name: String::from("daily"),
    };
    assert_eq!(map_cli(&missing).exit_code, 3);
    assert_eq!(map_api(&missing).status, 404);

    let storage = CoreError::from(io::Error::new(
        io::ErrorKind::PermissionDenied,
        "private filesystem detail",
    ));
    assert!(Error::source(&storage).is_some());
    assert_eq!(map_cli(&storage).exit_code, 1);
    assert!(map_cli(&storage).stderr.contains("private filesystem detail"));
    let api = map_api(&storage);
    assert_eq!(api.status, 500);
    assert_eq!(api.code, "internal_error");
    assert_eq!(api.message, "internal server error");
    assert!(!api.message.contains("private filesystem detail"));
}
~~~

这个库错误类型不包含 CLI 退出码、HTTP 状态或 JSON 文案；它只说明发生了哪一种领域失败，并在 Storage 中保留 io::Error。库使用者可以自己决定如何呈现。

## CLI 与 API 分别翻译同一错误

本例的 CLI 退出码是该命令的应用契约：无效参数用 2、缺失 profile 用 3、存储故障用 1。它们不是 Rust 或所有 CLI 工具的通用标准。命令行是本机边界，可以在 stderr 输出供操作者诊断的底层信息。

API 把无效端口映射为 400、缺失 profile 映射为 404、未预期的存储故障映射为 500。RFC 9110 将 400 定义为客户端错误、404 表示未找到目标资源、500 表示服务器遇到未预期情况。API 返回稳定错误码和安全摘要；底层存储路径、权限细节等只应进入受控日志或诊断，不进入远端响应。

这样同一个 CoreError::Storage 在库层保有原始 io::Error；CLI 可给本机操作者较详细的错误；API 对用户返回通用 500。CoreError::InvalidPort 则保留为可修正的输入问题，不能被粗暴地全部映射成内部故障。

## 边界映射规则

- **库边界**：保留领域类别和 source，不依赖终端、HTTP 或 JSON。
- **CLI 边界**：映射稳定退出码与 stderr；退出码属于当前命令的公开契约。
- **API 边界**：映射合适状态码和稳定错误码；不要把内部源信息放进公开响应。
- **日志边界**：记录必要的错误链和关联信息，同时按数据访问规则防止敏感信息泄漏。
- **语义边界**：InvalidPort、ProfileNotFound 和 Storage 分别表示输入无效、资源缺失和系统故障，不能被一个泛化 InternalError 覆盖。

## 分层提示

1. **归属提示**：这个错误类型描述业务事实，还是输出渠道？CLI exit code 和 HTTP status 应放在哪层？
2. **映射提示**：错误来自调用者输入、缺失业务资源，还是内部依赖？分别对应什么响应？
3. **泄漏提示**：API 可否公开 io::Error 的原文？本地 CLI 操作者与远端客户端拥有相同诊断权限吗？
4. **来源提示**：库层包住 io::Error 后，source() 是否还能返回它？应用映射是否保留日志所需上下文？
5. **参考路径**：让库返回结构化 CoreError，再由两个独立映射函数分别构造 CLI 和 API 表示。

## 来源

- [标准库：Error](https://doc.rust-lang.org/std/error/trait.Error.html)
- [RFC 9110：HTTP Semantics，第 15 节状态码](https://www.rfc-editor.org/rfc/rfc9110.html#section-15)

领域类型与映射数据为原创。HTTP 状态语义依据 RFC 9110；CLI 退出码明确作为本例自己的命令契约，而非通用规范。
