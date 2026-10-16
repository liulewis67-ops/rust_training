/// Formats a non-negative integer number of cents as a decimal amount.
///
/// The result always contains two digits after the decimal point and has no
/// currency symbol or grouping separators.
pub fn format_cents(amount_cents: u32) -> String {
    format!("{}.{:02}", amount_cents / 100, amount_cents % 100)
}
