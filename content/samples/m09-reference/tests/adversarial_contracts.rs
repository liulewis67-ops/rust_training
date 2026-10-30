//! External contracts: error order, nested sources and safe presentation.
use rust_training_m09_reference::{
    parse_config, present_api, present_cli, ApiError, CliError, Config, ConfigError,
    ConfigErrorKind, HistoryError,
};
use std::{error::Error, fmt, io};

#[derive(Debug)]
struct StorageContext {
    source: io::Error,
}

impl fmt::Display for StorageContext {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("private transport context")
    }
}

impl Error for StorageContext {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        Some(&self.source)
    }
}

fn nested_storage_failure() -> HistoryError {
    HistoryError::StorageUnavailable(io::Error::other(StorageContext {
        source: io::Error::other(
            "postgresql://root:secret@db.internal:5432 SELECT private_table",
        ),
    }))
}

#[test]
fn l05_first_error_stays_first_across_crlf_unicode_and_malformed_followups() {
    let cases = [
        (
            "timeout_ms=1\r\nretry_limit=2\r\ntimeout_ms=not-a-number\r\n密钥=secret",
            ConfigErrorKind::DuplicateField,
            "timeout_ms", 3, 1,
        ),
        (
            "retry_limit=1\ntimeout_ms=4\nretry_limit=999\nother=secret",
            ConfigErrorKind::DuplicateField,
            "retry_limit", 3, 1,
        ),
        (
            "配置🧭\nretry_limit=256\ntimeout_ms=5",
            ConfigErrorKind::MissingDelimiter,
            "<line>", 1, 4,
        ),
        (
            "timeout_ms=1\n密钥=private\nretry_limit=255",
            ConfigErrorKind::UnknownField,
            "<unknown>", 2, 1,
        ),
        (
            "timeout_ms=1\nretry_limit=３\nretry_limit=2",
            ConfigErrorKind::InvalidValue,
            "retry_limit", 2, 13,
        ),
    ];
    for (input, kind, field, line, column) in cases {
        let err = parse_config(input).expect_err(input);
        assert_eq!(err, ConfigError { kind, field, line, column });
        for token in ["secret", "private", "not-a-number", "密钥", "３"] {
            let public = format!("{err} {err:?}");
            assert!(!public.contains(token), "untrusted text leaked: {token}");
        }
    }
}

#[test]
fn l05_exact_numeric_bounds_missing_fields_and_extra_delimiters() {
    assert_eq!(
        parse_config("retry_limit=255\ntimeout_ms=18446744073709551615"),
        Ok(Config { timeout_ms: u64::MAX, retry_limit: u8::MAX }),
    );
    for (source, kind, field, line, column) in [
        ("timeout_ms=18446744073709551616\nretry_limit=0",
            ConfigErrorKind::InvalidValue, "timeout_ms", 1, 12),
        ("retry_limit=256\ntimeout_ms=1",
            ConfigErrorKind::InvalidValue, "retry_limit", 1, 13),
        ("timeout_ms=1=2\nretry_limit=1",
            ConfigErrorKind::InvalidValue, "timeout_ms", 1, 12),
        ("retry_limit=1\n",
            ConfigErrorKind::MissingField, "timeout_ms", 2, 1),
        ("timeout_ms=0\n",
            ConfigErrorKind::MissingField, "retry_limit", 2, 1),
    ] {
        assert_eq!(
            parse_config(source).unwrap_err(),
            ConfigError { kind, field, line, column },
            "input={source:?}",
        );
    }
}

#[test]
fn l06_nested_error_chain_survives_multiple_public_presentations() {
    let error = nested_storage_failure();
    let level_one = error.source().expect("domain error -> io error");
    // std::io::Error may expose the wrapped cause's source directly instead
    // of retaining every custom context wrapper as a separate chain node.
    let root_cause = level_one.source().expect("io error -> private root cause");
    assert!(root_cause.to_string().contains("root:secret@db.internal"));
    assert_eq!(error.to_string(), "history storage unavailable");
    assert!(root_cause.source().is_none());

    for id in ["", "请求-🧭", "line\ntrace", " space / % & = "] {
        let expected = ApiError {
            status: 503,
            code: "history_unavailable",
            message: "history service is temporarily unavailable; retry later.",
            retryable: true,
            request_id: id.to_owned(),
        };
        assert_eq!(present_api(&error, id), expected);
        assert_eq!(present_api(&error, id), expected); // no consumed or cached error
        let cli = present_cli(&error);
        assert_eq!(cli, CliError {
            exit_code: 1,
            stderr: "error: history service is temporarily unavailable; try again later\n".into(),
        });
        for public in [cli.stderr, expected.message.into(), expected.code.into()] {
            for secret in ["root", "secret", "db.internal", "private_table", "SELECT"] {
                assert!(!public.contains(secret), "secret leaked into public response");
            }
        }
    }
    assert!(error.source().is_some(), "presentation cannot consume the diagnostic chain");
}

#[test]
fn l06_all_domain_variants_have_stable_exact_cli_and_http_contracts() {
    let cases = [
        (
            HistoryError::InvalidRetentionDays,
            2, "error: retention-days must be an integer from 1 to 365\n",
            400, "invalid_retention_days",
            "retention_days must be an integer from 1 to 365.", false,
        ),
        (
            HistoryError::ProfileNotFound,
            3, "error: profile was not found\n",
            404, "profile_not_found", "profile was not found.", false,
        ),
        (
            nested_storage_failure(),
            1, "error: history service is temporarily unavailable; try again later\n",
            503, "history_unavailable",
            "history service is temporarily unavailable; retry later.", true,
        ),
    ];
    for (error, exit, stderr, status, code, message, retryable) in cases {
        assert_eq!(present_cli(&error), CliError { exit_code: exit, stderr: stderr.into() });
        assert_eq!(present_api(&error, "事件-1"), ApiError {
            status, code, message, retryable, request_id: "事件-1".into(),
        });
    }
}
