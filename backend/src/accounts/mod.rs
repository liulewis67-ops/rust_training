//! 本地邮箱密码账号、邮箱验证、服务端会话和密码恢复。

pub(crate) mod mailer;
mod rate_limit;
mod routes;
mod security;
pub(crate) mod store;

use lettre::message::Mailbox;
use uuid::Uuid;

pub(crate) use routes::router;
pub(crate) use routes::{logout, session_info};

/// 邮箱展示地址与大小写不敏感查找键的组合。
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct NormalizedEmail {
    pub(super) normalized: String,
    pub(super) display: String,
}

/// 校验单一邮箱地址并生成查找键，同时保留用户输入用于展示。
///
/// # Errors
/// 地址语法、控制字符或长度不满足约束时返回 `InvalidEmail`。
pub(super) fn normalize_email(input: &str) -> Result<NormalizedEmail, ValidationError> {
    let display = input.trim();
    if display.is_empty() || display.len() > 254 || display.chars().any(char::is_control) {
        return Err(ValidationError::InvalidEmail);
    }
    let mailbox = display
        .parse::<Mailbox>()
        .map_err(|_| ValidationError::InvalidEmail)?;
    if mailbox.name.is_some() || mailbox.email.to_string() != display {
        return Err(ValidationError::InvalidEmail);
    }
    Ok(NormalizedEmail {
        normalized: display.to_ascii_lowercase(),
        display: display.to_owned(),
    })
}

/// 本地账号输入校验错误。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum ValidationError {
    InvalidEmail,
    InvalidPassword,
}

/// 生成不依赖邮箱地址的随机稳定账号标识。
pub(super) fn new_account_id() -> String {
    Uuid::new_v4().to_string()
}

#[cfg(test)]
mod tests;
