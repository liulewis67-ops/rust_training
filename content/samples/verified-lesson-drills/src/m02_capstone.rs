//! M02-L05: checked unit conversion. M02-L06: independent checked addition.
pub fn minutes_to_seconds(raw: &str) -> Result<u64, &'static str> {
    if raw.is_empty() || !raw.bytes().all(|b| b.is_ascii_digit()) {
        return Err("invalid minute text");
    }
    let minutes = raw.parse::<u64>().map_err(|_| "invalid minute text")?;
    minutes.checked_mul(60).ok_or("seconds overflow")
}
pub fn checked_total(base: u32, adjustment: u32) -> Result<u32, &'static str> {
    base.checked_add(adjustment).ok_or("sum overflow")
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn l05_parsing_checks_ascii_form_and_multiplication_boundary() {
        assert_eq!(minutes_to_seconds("0"), Ok(0));
        assert_eq!(minutes_to_seconds("12"), Ok(720));
        for invalid in ["", "-1", "+2", " 2", "1.5", "四", "18446744073709551616"] {
            assert_eq!(minutes_to_seconds(invalid), Err("invalid minute text"));
        }
        let safe = u64::MAX / 60;
        assert_eq!(minutes_to_seconds(&safe.to_string()), Ok(safe * 60));
        assert_eq!(minutes_to_seconds(&(safe + 1).to_string()), Err("seconds overflow"));
    }
    #[test]
    fn l06_independent_checked_sum_preserves_all_u32_boundaries() {
        assert_eq!(checked_total(0, 0), Ok(0));
        assert_eq!(checked_total(17, 23), Ok(40));
        assert_eq!(checked_total(u32::MAX, 0), Ok(u32::MAX));
        assert_eq!(checked_total(0, u32::MAX), Ok(u32::MAX));
        assert_eq!(checked_total(u32::MAX, 1), Err("sum overflow"));
        assert_eq!(checked_total(1, u32::MAX), Err("sum overflow"));
    }
}
