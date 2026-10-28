# M09-L04 练习：panic、恢复策略与错误信息

> **练习路线：** 先预测输入失败与程序缺陷的区别，再修复错误返回和敏感信息泄漏。

## 学习目标与顺序

按“预测 → 修复 → 实现”完成三项练习。先记录预期的编译结果、返回值或错误来源，再运行本地 Rust 1.95.0 / Edition 2024 检查；本稿尚未作为公开课程发布。

## 1. 修复：用户输入不应变成 panic

下面的 parse_limit 对非法输入调用 expect。修复函数接口和实现，让合法值返回 Ok，非法文本以原始 ParseIntError 返回 Err；不要 catch_unwind 后把 panic 转成普通业务错误。

~~~rust
/// Parses a user-provided limit but panics when input is invalid.
fn parse_limit(raw: &str) -> u16 {
    raw.trim()
        .parse::<u16>()
        .expect("invalid limit from private request")
}

/// Checks that invalid input is returned rather than panicking.
fn main() {
    let observed = std::panic::catch_unwind(|| parse_limit("not-a-number"));
    assert!(observed.is_ok());
}
~~~

**提示**：将返回类型改为 Result<u16, ParseIntError>。解析结果直接返回即可，不要 unwrap、expect，也不要把具体错误丢掉。

**验证契约**：原始实现触发 panic，外层 catch 使 observed 为 Err，断言失败；修复后 parse_limit 返回 Err(ParseIntError)，闭包正常结束，断言通过。对普通输入问题，根本不需要捕获 panic。

## 2. 实现：给用户安全消息，保留诊断分类

实现 public_message：无效 limit 返回可修正的稳定说明；Storage 失败返回通用消息。错误类型和 diagnostic_code 已给出。不得将 source 文本、原始请求值或私有路径拼进公共消息。

~~~rust
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

/// Chooses a stable message that is safe to show to a request user.
fn public_message(error: &RequestError) -> &'static str {
    // TODO: Return a distinct safe message for each category.
    todo!()
}

/// Gives each failure class a stable internal diagnostic category.
fn diagnostic_code(error: &RequestError) -> &'static str {
    match error {
        RequestError::InvalidLimit(_) => "invalid_limit",
        RequestError::Storage(_) => "storage_failure",
    }
}

/// Checks that public messages are useful without exposing private details.
fn main() {
    let invalid = RequestError::InvalidLimit("private-token".parse::<u16>().unwrap_err());
    let storage = RequestError::Storage(io::Error::new(
        io::ErrorKind::PermissionDenied,
        "private filesystem path",
    ));
    assert_eq!(
        public_message(&invalid),
        "limit must be an unsigned 16-bit integer"
    );
    assert_eq!(public_message(&storage), "request could not be completed");
    assert_eq!(diagnostic_code(&storage), "storage_failure");
    assert!(!public_message(&storage).contains("private filesystem path"));
}
~~~

**提示**：先按枚举变体匹配，再为每种错误写固定消息。source 可用于受控诊断，不需要复制到公共响应。

**验证契约**：无效输入和存储故障消息不同；Storage 的公开消息不包含模拟路径，诊断类别仍能识别 storage_failure。

## 3. 设计评审：在哪一层捕获 panic？

某 HTTP handler 用 catch_unwind 包住每个业务请求；无论捕获到什么，都返回“请求成功，结果为空”，并把 panic payload 原文发给客户端。评审这项设计：

1. 哪些情况应改用 Result，而不是制造 panic 再捕获？
2. catch_unwind 在 panic=abort 时会怎样？panic hook 会不会运行？
3. 如果确实需要隔离可扩展插件的 panic，捕获后还要证明什么，才能安全继续用共享状态？
4. 面向客户端和受控日志分别应保留哪些信息？

**提示**：区分处理业务失败、组件故障隔离和内部不变量损坏。被捕获不等于状态已恢复。

**验证契约**：有效评审指出输入/缺失/常见依赖错误应通过 Result，不能伪装成功；panic=abort 不可捕获且 hook 在捕获前运行；隔离后需保证共享不变量有效或丢弃该状态；客户端只收到稳定安全消息，内部 panic/source 仅进入访问受控、经过筛选的诊断。

## 自查清单

- [ ] 普通输入解析用 `Result` 表达失败。
- [ ] 了解 `catch_unwind` 对 abort 的限制，不能把它当作全局业务恢复。
- [ ] 公开消息不回显内部机密，诊断信息另行受控保存。

以上检查请以实际代码和行为断言为准，而不是仅凭工具链返回退出码为 0。
