use m01_l05_receipt_total::discounted_total_cents;

/// Checks that no discount preserves the original subtotal.
#[test]
fn zero_percent_preserves_total() {
    assert_eq!(discounted_total_cents(2_450, 0), 2_450);
}

/// Checks the specified ten-percent discount in whole cents.
#[test]
fn ten_percent_discount_reduces_total() {
    assert_eq!(discounted_total_cents(10_000, 10), 9_000);
}

/// Checks that a full discount reduces the total to zero.
#[test]
fn full_discount_reduces_total_to_zero() {
    assert_eq!(discounted_total_cents(2_500, 100), 0);
}
