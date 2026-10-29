//! Independent executable contracts for M01-L05 (repair) and M01-L06 (clean-room delivery).
/// L05: valid inputs are 0..=1_000_000 cents and 0..=100 percent.
pub fn discounted_total_cents(subtotal_cents: i64, discount_percent: u8) -> i64 {
    assert!((0..=1_000_000).contains(&subtotal_cents));
    assert!(discount_percent <= 100);
    subtotal_cents - subtotal_cents * i64::from(discount_percent) / 100
}
/// L06: a new function, independent of the discount lab.
pub fn format_cents(amount_cents: u32) -> String {
    format!("{}.{:02}", amount_cents / 100, amount_cents % 100)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn l05_discount_contract_handles_zero_rounding_and_full_discount() {
        assert_eq!(discounted_total_cents(0, 10), 0);
        assert_eq!(discounted_total_cents(100, 10), 90);
        assert_eq!(discounted_total_cents(1, 50), 1); // Integer discount rounds down.
        assert_eq!(discounted_total_cents(1_000_000, 100), 0);
        assert_eq!(discounted_total_cents(1_000_000, 0), 1_000_000);
    }
    #[test]
    fn l06_formatting_is_independent_and_covers_fractional_edges() {
        for (cents, expected) in [(0, "0.00"), (7, "0.07"), (82, "0.82"),
            (1000, "10.00"), (1234, "12.34"), (4007, "40.07"),
            (1_000_000, "10000.00"), (u32::MAX, "42949672.95")] {
            assert_eq!(format_cents(cents), expected);
        }
    }
}
