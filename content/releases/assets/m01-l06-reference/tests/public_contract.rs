use amount_formatter::format_cents;

/// Checks that zero cents keeps the required two fractional digits.
#[test]
fn formats_zero_cents() {
    assert_eq!(format_cents(0), "0.00");
}

/// Checks that a value below one dollar includes a leading zero.
#[test]
fn formats_single_digit_cents() {
    assert_eq!(format_cents(7), "0.07");
}

/// Checks that a whole dollar includes a zero fractional part.
#[test]
fn formats_whole_dollars() {
    assert_eq!(format_cents(1_000), "10.00");
}

/// Checks that dollars and cents are split at the hundred-cent boundary.
#[test]
fn formats_dollars_and_cents() {
    assert_eq!(format_cents(1_234), "12.34");
}
