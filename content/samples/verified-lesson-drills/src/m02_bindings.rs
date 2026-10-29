//! M02-L01: mutability and numeric conversions are distinct rules.
pub fn parse_retry_limit(raw: &str) -> Result<u8, &'static str> {
    let wide = raw.parse::<u32>().map_err(|_| "not a number")?;
    u8::try_from(wide).map_err(|_| "out of u8 range")
}
pub fn increment_from(value: u8) -> u16 {
    let mut counter: u16 = u16::from(value);
    counter += 1;
    counter
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn mutable_binding_does_not_enable_implicit_widening() {
        assert_eq!(increment_from(0), 1);
        assert_eq!(increment_from(u8::MAX), 256);
        let source = "42";
        let source = source.parse::<u8>().unwrap(); // A new shadowed binding.
        assert_eq!(source, 42);
    }
    #[test]
    fn parsing_and_numeric_range_fail_for_different_reasons() {
        assert_eq!(parse_retry_limit("0"), Ok(0));
        assert_eq!(parse_retry_limit("255"), Ok(255));
        assert_eq!(parse_retry_limit("256"), Err("out of u8 range"));
        assert_eq!(parse_retry_limit("abc"), Err("not a number"));
        assert_eq!(parse_retry_limit("-1"), Err("not a number"));
    }
}
