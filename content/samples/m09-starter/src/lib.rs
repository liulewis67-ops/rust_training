use std::error::Error;
use std::fmt;
use std::io;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Config {
    pub timeout_ms: u64,
    pub retry_limit: u8,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigErrorKind {
    MissingDelimiter,
    UnknownField,
    DuplicateField,
    InvalidValue,
    MissingField,
}

/// A safe error descriptor: never retains untrusted values or unknown keys.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ConfigError {
    pub kind: ConfigErrorKind,
    pub field: &'static str,
    pub line: usize,
    pub column: usize,
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:?} at {}:{} ({})", self.kind, self.line, self.column, self.field)
    }
}

impl Error for ConfigError {}

fn config_error(
    kind: ConfigErrorKind,
    field: &'static str,
    line: usize,
    column: usize,
) -> ConfigError {
    ConfigError { kind, field, line, column }
}

/// The domain error must not depend on HTTP frameworks or CLI exit codes.
#[derive(Debug)]
pub enum HistoryError {
    InvalidRetentionDays,
    ProfileNotFound,
    StorageUnavailable(io::Error),
}

impl fmt::Display for HistoryError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidRetentionDays => f.write_str("invalid retention days"),
            Self::ProfileNotFound => f.write_str("profile not found"),
            Self::StorageUnavailable(_) => f.write_str("history storage unavailable"),
        }
    }
}

impl Error for HistoryError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::StorageUnavailable(cause) => Some(cause),
            _ => None,
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
pub struct CliError {
    pub exit_code: i32,
    pub stderr: String,
}

#[derive(Debug, PartialEq, Eq)]
pub struct ApiError {
    pub status: u16,
    pub code: &'static str,
    pub message: &'static str,
    pub retryable: bool,
    pub request_id: String,
}
/// Parse a strict, two-field UTF-8 config without echoing invalid values.
pub fn parse_config(input: &str) -> Result<Config, ConfigError> {
    let mut timeout_ms = None;
    let mut retry_limit = None;

    for (index, line) in input.lines().enumerate() {
        if line.is_empty() {
            continue;
        }
        let line_no = index + 1;
        let Some((key, value)) = line.split_once('=') else {
            return Err(config_error(
                ConfigErrorKind::MissingDelimiter,
                "<line>",
                line_no,
                line.chars().count() + 1,
            ));
        };
        let (field, duplicate) = match key {
            "timeout_ms" => ("timeout_ms", timeout_ms.is_some()),
            "retry_limit" => ("retry_limit", retry_limit.is_some()),
            _ => {
                return Err(config_error(
                    ConfigErrorKind::UnknownField,
                    "<unknown>",
                    line_no,
                    1,
                ))
            }
        };
        // BUG: duplicate fields are silently overwritten by later values.
        let _ = duplicate;
        let value_column = key.chars().count() + 2;
        if value.is_empty() || !value.bytes().all(|byte| byte.is_ascii_digit()) {
            return Err(config_error(
                ConfigErrorKind::InvalidValue, field, line_no, value_column,
            ));
        }
        match field {
            "timeout_ms" => {
                timeout_ms = Some(value.parse::<u64>().map_err(|_| {
                    config_error(ConfigErrorKind::InvalidValue, field, line_no, value_column)
                })?);
            }
            "retry_limit" => {
                retry_limit = Some(value.parse::<u8>().map_err(|_| {
                    config_error(ConfigErrorKind::InvalidValue, field, line_no, value_column)
                })?);
            }
            _ => unreachable!("field is matched against the two known names"),
        }
    }

    let eof_line = input.lines().count() + 1;
    let timeout_ms = timeout_ms.ok_or_else(|| {
        config_error(ConfigErrorKind::MissingField, "timeout_ms", eof_line, 1)
    })?;
    let retry_limit = retry_limit.ok_or_else(|| {
        config_error(ConfigErrorKind::MissingField, "retry_limit", eof_line, 1)
    })?;
    Ok(Config { timeout_ms, retry_limit })
}

/// Translate domain errors only at the CLI boundary.
pub fn present_cli(error: &HistoryError) -> CliError {
    let (exit_code, stderr) = match error {
        HistoryError::InvalidRetentionDays => (
            2,
            "error: retention-days must be an integer from 1 to 365\n",
        ),
        HistoryError::ProfileNotFound => (
            3,
            "error: profile was not found\n",
        ),
        HistoryError::StorageUnavailable(_) => (
            1,
            "error: history service is temporarily unavailable; try again later\n",
        ),
    };
    CliError { exit_code, stderr: stderr.to_owned() }
}

/// Translate domain errors without exposing underlying storage diagnostics.
pub fn present_api(error: &HistoryError, request_id: &str) -> ApiError {
    let (status, code, message, retryable) = match error {
        HistoryError::InvalidRetentionDays => (
            400,
            "invalid_retention_days",
            "retention_days must be an integer from 1 to 365.",
            false,
        ),
        HistoryError::ProfileNotFound => (
            404,
            "profile_not_found",
            "profile was not found.",
            false,
        ),
        HistoryError::StorageUnavailable(_) => (
            503,
            "history_unavailable",
            "history service is temporarily unavailable; retry later.",
            false, // BUG: retriable storage outage is classified as permanent.
        ),
    };
    ApiError {
        status,
        code,
        message,
        retryable,
        request_id: request_id.to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn check_error(
        result: Result<Config, ConfigError>,
        kind: ConfigErrorKind,
        field: &'static str,
        line: usize,
        column: usize,
    ) {
        let error = result.expect_err("expected a structured parser error");
        assert_eq!((error.kind, error.field, error.line, error.column),
                   (kind, field, line, column));
    }

    #[test]
    fn l05_valid_fields_and_crlf() {
        assert_eq!(
            parse_config("retry_limit=3\r\ntimeout_ms=250\r\n"),
            Ok(Config { timeout_ms: 250, retry_limit: 3 })
        );
        assert_eq!(
            parse_config("\ntimeout_ms=0\n\nretry_limit=0\n"),
            Ok(Config { timeout_ms: 0, retry_limit: 0 })
        );
    }

    #[test]
    fn l05_duplicate_fields_are_not_overwritten() {
        check_error(
            parse_config("timeout_ms=5\nretry_limit=2\ntimeout_ms=7"),
            ConfigErrorKind::DuplicateField,
            "timeout_ms", 3, 1,
        );
        check_error(
            parse_config("retry_limit=1\nretry_limit=2\ntimeout_ms=5"),
            ConfigErrorKind::DuplicateField,
            "retry_limit", 2, 1,
        );
    }

    #[test]
    fn l05_unknown_field_and_unicode_columns() {
        check_error(
            parse_config("密钥=private\ntimeout_ms=5\nretry_limit=1"),
            ConfigErrorKind::UnknownField,
            "<unknown>", 1, 1,
        );
        check_error(
            parse_config("配置错"),
            ConfigErrorKind::MissingDelimiter,
            "<line>", 1, 4,
        );
    }

    #[test]
    fn l05_invalid_value_boundary_and_no_secret_echo() {
        for source in [
            "timeout_ms=123\nretry_limit=256",
            "timeout_ms=123\nretry_limit=３",
            "timeout_ms=123\nretry_limit= 3",
            "timeout_ms=123\nretry_limit=",
        ] {
            check_error(
                parse_config(source), ConfigErrorKind::InvalidValue,
                "retry_limit", 2, 13,
            );
        }
        let error = parse_config("password=my-secret").unwrap_err();
        let shown = format!("{error:?} {error}");
        assert!(!shown.contains("password"));
        assert!(!shown.contains("my-secret"));
    }

    #[test]
    fn l05_missing_fields_and_eof() {
        check_error(parse_config(""), ConfigErrorKind::MissingField, "timeout_ms", 1, 1);
        check_error(
            parse_config("timeout_ms=1\n"),
            ConfigErrorKind::MissingField, "retry_limit", 2, 1,
        );
    }

    fn storage_error() -> HistoryError {
        HistoryError::StorageUnavailable(io::Error::other(
            "postgresql://admin:secret@internal-db:5432?sql=SELECT",
        ))
    }

    #[test]
    fn l06_cli_error_contracts() {
        assert_eq!(present_cli(&HistoryError::InvalidRetentionDays), CliError {
            exit_code: 2,
            stderr: "error: retention-days must be an integer from 1 to 365\n".to_owned(),
        });
        assert_eq!(present_cli(&HistoryError::ProfileNotFound), CliError {
            exit_code: 3,
            stderr: "error: profile was not found\n".to_owned(),
        });
        assert_eq!(present_cli(&storage_error()), CliError {
            exit_code: 1,
            stderr: "error: history service is temporarily unavailable; try again later\n".to_owned(),
        });
    }

    #[test]
    fn l06_api_status_code_retry_and_request_id() {
        let cases = [
            (HistoryError::InvalidRetentionDays, 400, "invalid_retention_days",
                "retention_days must be an integer from 1 to 365.", false),
            (HistoryError::ProfileNotFound, 404, "profile_not_found",
                "profile was not found.", false),
            (storage_error(), 503, "history_unavailable",
                "history service is temporarily unavailable; retry later.", true),
        ];
        for (error, status, code, message, retryable) in cases {
            assert_eq!(present_api(&error, "req-1001"), ApiError {
                status, code, message, retryable,
                request_id: "req-1001".to_owned(),
            });
        }
    }

    #[test]
    fn l06_internal_cause_survives_public_redaction() {
        let storage = storage_error();
        let cause = storage.source().expect("internal cause must remain inspectable");
        assert!(cause.to_string().contains("admin:secret"));
        let cli = present_cli(&storage);
        let api = present_api(&storage, "trace-abc");
        for public in [cli.stderr, api.message.to_owned(), api.code.to_owned()] {
            assert!(!public.contains("admin:secret"));
            assert!(!public.contains("internal-db"));
            assert!(!public.contains("SELECT"));
        }
        assert!(HistoryError::InvalidRetentionDays.source().is_none());
        assert!(HistoryError::ProfileNotFound.source().is_none());
    }

    #[test]
    fn l05_duplicate_precedes_later_unknown_fields_and_bad_values() {
        check_error(
            parse_config("timeout_ms=1\nretry_limit=2\ntimeout_ms=3\nunknown=private"),
            ConfigErrorKind::DuplicateField, "timeout_ms", 3, 1,
        );
        check_error(
            parse_config("retry_limit=1\nretry_limit=999\ntimeout_ms=5"),
            ConfigErrorKind::DuplicateField, "retry_limit", 2, 1,
        );
    }

    #[test]
    fn l05_extreme_values_and_multibyte_missing_delimiter() {
        assert_eq!(
            parse_config("timeout_ms=18446744073709551615\nretry_limit=255"),
            Ok(Config { timeout_ms: u64::MAX, retry_limit: u8::MAX }),
        );
        check_error(
            parse_config("timeout_ms=18446744073709551616\nretry_limit=1"),
            ConfigErrorKind::InvalidValue, "timeout_ms", 1, 12,
        );
        check_error(
            parse_config("中文配置"),
            ConfigErrorKind::MissingDelimiter, "<line>", 1, 5,
        );
        check_error(
            parse_config("timeout_ms=9\nretry_limit=1\r\nretry_limit=2"),
            ConfigErrorKind::DuplicateField, "retry_limit", 3, 1,
        );
    }

    #[test]
    fn l06_unicode_request_id_and_internal_diagnostics_are_separate() {
        let error = HistoryError::StorageUnavailable(io::Error::other(
            "server=db.internal password=secret SELECT * FROM history",
        ));
        let cause = error.source().expect("storage cause stays available");
        assert!(cause.to_string().contains("password=secret"));
        for request_id in ["", "请求-🧭-42", "line\ntrace"] {
            let api = present_api(&error, request_id);
            assert_eq!(api.request_id, request_id);
            assert_eq!((api.status, api.code, api.retryable),
                (503, "history_unavailable", true));
            let cli = present_cli(&error);
            assert_eq!(cli.exit_code, 1);
            for public in [
                api.message.to_owned(), api.code.to_owned(), cli.stderr,
            ] {
                assert!(!public.contains("password"));
                assert!(!public.contains("secret"));
                assert!(!public.contains("db.internal"));
                assert!(!public.contains("SELECT"));
            }
        }
        for error in [HistoryError::InvalidRetentionDays, HistoryError::ProfileNotFound] {
            assert!(!present_api(&error, "req").retryable);
            assert!(error.source().is_none());
        }
    }
}
