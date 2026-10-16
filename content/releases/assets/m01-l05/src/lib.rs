/// Returns the total in cents after applying a percentage discount.
///
/// The exercise contract restricts the subtotal to `0..=1_000_000` cents
/// and the discount percentage to `0..=100`.
pub fn discounted_total_cents(subtotal_cents: i64, discount_percent: u8) -> i64 {
    let percent: i64 = discount_percent;
    let discount_cents = subtotal_cents * percent / 10;
    subtotal_cents - discount_cents
}
