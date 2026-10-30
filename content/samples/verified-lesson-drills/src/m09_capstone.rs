//! M09-L05: strict position-aware configuration; M09-L06: independent safe adapters.
#[derive(Debug, PartialEq, Eq)]
pub struct Config { pub timeout_ms: u64, pub retry_limit: u8 }
#[derive(Debug, PartialEq, Eq)]
pub enum ParseKind { UnknownField, MissingField, DuplicateField, InvalidValue, InvalidLine }
#[derive(Debug, PartialEq, Eq)]
pub struct ConfigError { pub kind: ParseKind, pub line: usize, pub column: usize }
pub fn parse_config(raw: &str) -> Result<Config, ConfigError> {
    let mut timeout = None;
    let mut retries = None;
    for (index, text) in raw.lines().enumerate() {
        let line = index + 1;
        let text = text.strip_suffix('\r').unwrap_or(text);
        if text.is_empty() { continue; }
        let Some((key, value)) = text.split_once('=') else {
            return Err(ConfigError { kind: ParseKind::InvalidLine, line, column: text.chars().count() + 1 });
        };
        // Classify the field before parsing its value: a repeated key is the
        // first error on that line even when its replacement value is malformed.
        let duplicate = match key {
            "timeout_ms" => timeout.is_some(),
            "retry_limit" => retries.is_some(),
            _ => return Err(ConfigError { kind: ParseKind::UnknownField, line, column: 1 }),
        };
        if duplicate {
            return Err(ConfigError { kind: ParseKind::DuplicateField, line, column: 1 });
        }
        let first_value_column = key.chars().count() + 2; // 1-based; after the '='.
        if value.is_empty() || !value.bytes().all(|b| b.is_ascii_digit()) {
            return Err(ConfigError { kind: ParseKind::InvalidValue, line, column: first_value_column });
        }
        match key {
            "timeout_ms" => {
                timeout = Some(value.parse::<u64>().map_err(|_| ConfigError {
                    kind: ParseKind::InvalidValue, line, column: first_value_column
                })?);
            }
            "retry_limit" => {
                retries = Some(value.parse::<u8>().map_err(|_| ConfigError {
                    kind: ParseKind::InvalidValue, line, column: first_value_column
                })?);
            }
            _ => unreachable!("field validated above"),
        }
    }
    Ok(Config {
        timeout_ms: timeout.ok_or(ConfigError { kind: ParseKind::MissingField, line: 1, column: 1 })?,
        retry_limit: retries.ok_or(ConfigError { kind: ParseKind::MissingField, line: 1, column: 1 })?,
    })
}
#[derive(Debug, PartialEq, Eq)]
pub enum HistoryError { InvalidRetention, ProfileMissing, StorageUnavailable(String) }
#[derive(Debug, PartialEq, Eq)]
pub struct ApiFailure {
    pub status: u16, pub code: &'static str, pub message: &'static str,
    pub retryable: bool, pub request_id: String
}
#[derive(Debug, PartialEq, Eq)]
pub struct CliFailure { pub exit_code: u8, pub stderr: &'static str }
pub fn present_api(error: &HistoryError, request_id: &str) -> ApiFailure {
    match error {
        HistoryError::InvalidRetention => ApiFailure { status: 400, code: "invalid_retention_days", message: "invalid retention days", retryable: false, request_id: request_id.into() },
        HistoryError::ProfileMissing => ApiFailure { status: 404, code: "profile_not_found", message: "profile not found", retryable: false, request_id: request_id.into() },
        HistoryError::StorageUnavailable(_) => ApiFailure { status: 503, code: "storage_unavailable", message: "temporarily unavailable", retryable: true, request_id: request_id.into() },
    }
}
pub fn present_cli(error: &HistoryError) -> CliFailure {
    match error {
        HistoryError::InvalidRetention => CliFailure { exit_code: 2, stderr: "error: invalid retention days\n" },
        HistoryError::ProfileMissing => CliFailure { exit_code: 3, stderr: "error: profile not found\n" },
        HistoryError::StorageUnavailable(_) => CliFailure { exit_code: 1, stderr: "error: temporarily unavailable\n" },
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn l05_parsing_rejects_duplicate_invalid_and_missing_fields() {
        assert_eq!(parse_config("timeout_ms=250\nretry_limit=3"), Ok(Config { timeout_ms: 250, retry_limit: 3 }));
        assert_eq!(parse_config("retry_limit=3\r\ntimeout_ms=250\r\n"), Ok(Config { timeout_ms: 250, retry_limit: 3 }));
        assert_eq!(parse_config("timeout_ms=1\ntimeout_ms=2\nretry_limit=3").unwrap_err().kind, ParseKind::DuplicateField);
        assert_eq!(parse_config("timeout_ms=1\nretry_limit=256").unwrap_err().kind, ParseKind::InvalidValue);
        assert_eq!(parse_config("timeout_ms=1").unwrap_err().kind, ParseKind::MissingField);
        assert_eq!(parse_config("timeout_ms=1\nother=2").unwrap_err().kind, ParseKind::UnknownField);
    }
    #[test]
    fn l05_invalid_value_reports_character_column_without_leaking_input() {
        let e = parse_config("timeout_ms=12\nretry_limit=密").unwrap_err();
        assert_eq!(e, ConfigError { kind: ParseKind::InvalidValue, line: 2, column: 13 });
        assert!(!format!("{e:?}").contains("密"));
    }
    #[test]
    fn l05_first_structured_error_wins_even_when_later_input_is_malformed() {
        assert_eq!(
            parse_config("timeout_ms=1\ntimeout_ms=invalid\n未知=secret").unwrap_err(),
            ConfigError { kind: ParseKind::DuplicateField, line: 2, column: 1 },
        );
        assert_eq!(
            parse_config("未知=invalid\ntimeout_ms=1\nretry_limit=1").unwrap_err(),
            ConfigError { kind: ParseKind::UnknownField, line: 1, column: 1 },
        );
        assert_eq!(
            parse_config("timeout_ms=18446744073709551616\nretry_limit=1").unwrap_err(),
            ConfigError { kind: ParseKind::InvalidValue, line: 1, column: 12 },
        );
    }
    #[test]
    fn l06_cli_and_api_contracts_remain_separate_and_safe() {
        for (error, cli, status, retryable) in [
            (HistoryError::InvalidRetention, 2, 400, false),
            (HistoryError::ProfileMissing, 3, 404, false),
            (HistoryError::StorageUnavailable("db://password=secret".into()), 1, 503, true),
        ] {
            let c = present_cli(&error);
            let a = present_api(&error, "req-001");
            assert_eq!((c.exit_code, a.status, a.retryable), (cli, status, retryable));
            assert_eq!(a.request_id, "req-001");
            assert!(!format!("{}{}", c.stderr, a.message).contains("secret"));
        }
    }
}
