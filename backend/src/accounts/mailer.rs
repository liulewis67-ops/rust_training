//! 通过 SMTP 发送本地账号操作邮件。

use std::{collections::HashMap, time::Duration};

use async_trait::async_trait;
use lettre::{
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
    message::{Mailbox, header::ContentType},
    transport::smtp::authentication::Credentials,
};

/// 从环境变量读取并验证的 SMTP 连接配置。
pub(crate) struct SmtpConfig {
    host: String,
    port: u16,
    username: String,
    password: String,
    from: Mailbox,
    tls: SmtpTlsMode,
}

/// SMTP TLS 模式；禁止明文连接和降级协商。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum SmtpTlsMode {
    StartTlsRequired,
    ImplicitTls,
}

impl SmtpConfig {
    /// Read and validate all required SMTP variables from the process environment.
    ///
    /// # Errors
    /// Returns only the missing or invalid variable name, never its configured value.
    pub(crate) fn from_env() -> Result<Self, ConfigError> {
        let values = std::env::vars().collect::<HashMap<_, _>>();
        Self::from_map(&values)
    }

    /// Parse required settings from an injected map for deterministic tests.
    ///
    /// # Errors
    /// Returns a redacted configuration error naming the invalid variable.
    pub(super) fn from_map(values: &HashMap<String, String>) -> Result<Self, ConfigError> {
        let host = required(values, "SMTP_HOST")?;
        let port_text = required(values, "SMTP_PORT")?;
        let port = port_text
            .parse::<u16>()
            .ok()
            .filter(|port| *port != 0)
            .ok_or(ConfigError::Invalid("SMTP_PORT"))?;
        let username = required(values, "SMTP_USERNAME")?;
        let password = required(values, "SMTP_PASSWORD")?;
        let from_text = required(values, "SMTP_FROM")?;
        let from = from_text
            .parse::<Mailbox>()
            .map_err(|_| ConfigError::Invalid("SMTP_FROM"))?;
        let tls = match required(values, "SMTP_TLS")?.as_str() {
            "starttls_required" => SmtpTlsMode::StartTlsRequired,
            "implicit_tls" => SmtpTlsMode::ImplicitTls,
            _ => return Err(ConfigError::Invalid("SMTP_TLS")),
        };
        Ok(Self {
            host,
            port,
            username,
            password,
            from,
            tls,
        })
    }
}

/// 检查必填配置非空，错误中不包含配置值。
fn required(values: &HashMap<String, String>, name: &'static str) -> Result<String, ConfigError> {
    match values.get(name) {
        Some(value) if !value.trim().is_empty() => Ok(value.trim().to_owned()),
        _ => Err(ConfigError::Missing(name)),
    }
}

/// 一封账号操作邮件；不实现 Debug，避免令牌被日志输出。
pub(crate) struct ActionEmail {
    pub(super) recipient: Mailbox,
    pub(super) subject: String,
    pub(super) body: String,
}

/// 供请求处理器使用、并可由测试邮件器替换的异步投递接口。
#[async_trait]
pub(crate) trait Mailer: Send + Sync {
    /// Send an account action email without exposing message or token details in failures.
    async fn send_action(&self, email: ActionEmail) -> Result<(), MailError>;
}

/// 基于 Lettre 的异步 SMTP 适配器，使用认证加密传输。
pub(crate) struct SmtpMailer {
    transport: AsyncSmtpTransport<Tokio1Executor>,
    from: Mailbox,
}

impl SmtpMailer {
    /// Build a reusable TLS transport from validated configuration.
    ///
    /// # Errors
    /// Returns a redacted `SmtpTransport` error when the host cannot configure a TLS relay.
    pub(crate) fn new(config: SmtpConfig) -> Result<Self, ConfigError> {
        let credentials = Credentials::new(config.username, config.password);
        let builder = match config.tls {
            SmtpTlsMode::StartTlsRequired => {
                AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&config.host)
            }
            SmtpTlsMode::ImplicitTls => AsyncSmtpTransport::<Tokio1Executor>::relay(&config.host),
        }
        .map_err(|_| ConfigError::Invalid("SMTP_HOST"))?;
        let transport = builder
            .port(config.port)
            .credentials(credentials)
            .timeout(Some(Duration::from_secs(10)))
            .build();
        Ok(Self {
            transport,
            from: config.from,
        })
    }
}

#[async_trait]
impl Mailer for SmtpMailer {
    /// Send a plain-text account action message through the configured encrypted SMTP relay.
    async fn send_action(&self, email: ActionEmail) -> Result<(), MailError> {
        let message = Message::builder()
            .from(self.from.clone())
            .to(email.recipient)
            .subject(email.subject)
            .header(ContentType::TEXT_PLAIN)
            .body(email.body)
            .map_err(|_| MailError::Unavailable)?;
        self.transport
            .send(message)
            .await
            .map(|_| ())
            .map_err(|_| MailError::Unavailable)
    }
}

/// 不包含配置值的启动配置错误。
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum ConfigError {
    Missing(&'static str),
    Invalid(&'static str),
}

/// 不包含邮件内容的发送错误。
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum MailError {
    Unavailable,
}
