//! Fixed-seed model-based/differential checks for M09.
use rust_training_m09_reference::{
    parse_config, present_api, present_cli, ApiError, Config, ConfigError, ConfigErrorKind, HistoryError,
};
use std::{collections::BTreeMap, error::Error, io};

const SEED: u64 = 0xC0FF_EE09_2026_1030;
const CASES: usize = 384;
const LINES: [&str; 17] = [
    "", "timeout_ms=0", "retry_limit=0", "timeout_ms=18446744073709551615",
    "retry_limit=255", "retry_limit=256", "timeout_ms=18446744073709551616",
    "timeout_ms=8", "retry_limit=3", "timeout_ms=1=2", "密钥=private",
    "bad🧭", "retry_limit=３", "retry_limit= 3", "  ", "retry_limit=+1", "retry_limit=",
];

struct Generator(u64);
impl Generator {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }
    fn index(&mut self, bound: usize) -> usize {
        (self.next() % bound as u64) as usize
    }
}

fn fail(kind: ConfigErrorKind, field: &'static str, line: usize, column: usize) -> ConfigError {
    ConfigError { kind, field, line, column }
}

fn parse_oracle(input: &str) -> Result<Config, ConfigError> {
    // Different representation from the reference parser: a sorted map is a
    // symbol table; find('=') is the lexical boundary. No production helper is used.
    let mut symbol_table = BTreeMap::<&'static str, u64>::new();
    for (index, text) in input.lines().enumerate() {
        let row = index + 1;
        if text.is_empty() { continue; }
        let Some(split_at) = text.find('=') else {
            return Err(fail(ConfigErrorKind::MissingDelimiter, "<line>",
                row, text.chars().count() + 1));
        };
        let name = &text[..split_at];
        let digits = &text[split_at + 1..];
        let symbol = match name {
            "timeout_ms" => "timeout_ms",
            "retry_limit" => "retry_limit",
            _ => return Err(fail(ConfigErrorKind::UnknownField, "<unknown>", row, 1)),
        };
        if symbol_table.contains_key(symbol) {
            return Err(fail(ConfigErrorKind::DuplicateField, symbol, row, 1));
        }
        let first_digit_column = name.chars().count() + 2;
        let value = if !digits.is_empty() && digits.as_bytes().iter().all(u8::is_ascii_digit) {
            match symbol {
                "timeout_ms" => digits.parse::<u64>().ok(),
                "retry_limit" => digits.parse::<u8>().ok().map(u64::from),
                _ => unreachable!(),
            }
        } else {
            None
        };
        let Some(value) = value else {
            return Err(fail(ConfigErrorKind::InvalidValue, symbol, row, first_digit_column));
        };
        symbol_table.insert(symbol, value);
    }

    let eof = input.lines().count() + 1;
    let timeout_ms = *symbol_table.get("timeout_ms")
        .ok_or_else(|| fail(ConfigErrorKind::MissingField, "timeout_ms", eof, 1))?;
    let retry_limit = *symbol_table.get("retry_limit")
        .ok_or_else(|| fail(ConfigErrorKind::MissingField, "retry_limit", eof, 1))?;
    Ok(Config { timeout_ms, retry_limit: u8::try_from(retry_limit).unwrap() })
}

#[test]
fn model_differential_generated_config_grammar_and_first_failure() {
    let mut rng = Generator(SEED);
    for case in 0..CASES {
        let len = rng.index(11);
        let fields: Vec<_> = (0..len).map(|_| LINES[rng.index(LINES.len())]).collect();
        let separator = if rng.index(2) == 0 { "\n" } else { "\r\n" };
        let mut input = fields.join(separator);
        if rng.index(2) == 0 { input.push_str(separator); }

        let expected = parse_oracle(&input);
        let actual = parse_config(&input);
        assert_eq!(
            actual, expected, "seed={SEED:#x}, case={case}, input={input:?}"
        );
        if let Err(err) = actual {
            let public = format!("{err:?} {err}");
            for private in ["private", "密钥", "bad🧭", "18446744073709551616"] {
                assert!(!public.contains(private), "case={case}, leaked {private}");
            }
        }
    }
}

#[test]
fn model_metamorphic_valid_field_order_blank_lines_and_limits() {
    let limits = [
        ("0", "0", 0, 0),
        ("1", "1", 1, 1),
        ("18446744073709551615", "255", u64::MAX, u8::MAX),
    ];
    for (timeout, retry, number, count) in limits {
        for separator in ["\n", "\r\n"] {
            for trailing in ["", "\n"] {
                let a = format!("timeout_ms={timeout}{separator}retry_limit={retry}{trailing}");
                let b = format!("retry_limit={retry}{separator}timeout_ms={timeout}{trailing}");
                let c = format!("\n{b}{separator}\n");
                let expected = Ok(Config { timeout_ms: number, retry_limit: count });
                assert_eq!(parse_config(&a), expected);
                assert_eq!(parse_config(&b), expected);
                assert_eq!(parse_config(&c), expected);
            }
        }
    }
}

#[test]
fn model_differential_error_boundary_preserves_cause_without_public_leaks() {
    let mut rng = Generator(SEED ^ 0xA11E_2026);
    for case in 0..128 {
        let request_id = format!("请求-{case}-🧭-{} / \n", rng.next());
        let secret = format!("password=secret-{case}-{}", rng.next());
        let errors = [
            HistoryError::InvalidRetentionDays,
            HistoryError::ProfileNotFound,
            HistoryError::StorageUnavailable(io::Error::other(secret.clone())),
        ];
        let oracle = [
            (400, "invalid_retention_days", "retention_days must be an integer from 1 to 365.", false, 2),
            (404, "profile_not_found", "profile was not found.", false, 3),
            (503, "history_unavailable", "history service is temporarily unavailable; retry later.", true, 1),
        ];
        for (variant, (error, (status, code, message, retryable, exit))) in
            errors.iter().zip(oracle).enumerate()
        {
            let response = present_api(error, &request_id);
            assert_eq!(response, ApiError {
                status, code, message, retryable, request_id: request_id.clone(),
            }, "case={case}, variant={variant}");
            assert_eq!(present_cli(error).exit_code, exit);
            assert!(!format!("{} {}", response.message, response.code).contains(&secret));
            assert!(!present_cli(error).stderr.contains(&secret));
            if variant == 2 {
                assert!(error.source().unwrap().to_string().contains(&secret));
            } else {
                assert!(error.source().is_none());
            }
        }
    }
}
