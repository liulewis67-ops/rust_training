use minutes_to_seconds::minutes_to_seconds;

/// Checks conversion of an ordinary whole-minute value.
#[test]
fn converts_regular_minutes() {
    assert_eq!(minutes_to_seconds("12"), Ok(720));
}

/// Checks that zero is a valid amount rather than a missing value.
#[test]
fn accepts_zero_minutes() {
    assert_eq!(minutes_to_seconds("0"), Ok(0));
}

/// Checks that malformed, empty, and negative inputs are rejected.
#[test]
fn rejects_invalid_input() {
    assert!(minutes_to_seconds("").is_err());
    assert!(minutes_to_seconds("12x").is_err());
    assert!(minutes_to_seconds("-1").is_err());
    assert!(minutes_to_seconds("+1").is_err());
}

/// Checks that a representable minute value may still overflow after conversion.
#[test]
fn rejects_seconds_overflow() {
    assert!(minutes_to_seconds("18446744073709551615").is_err());
}
