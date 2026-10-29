//! M09-L01: ? propagates Err; incompatible error types must be mapped.
use std::num::ParseIntError;
pub fn parse_timeout(text: &str) -> Result<u32, ParseIntError> {
    let value = text.parse::<u32>()?;
    Ok(value)
}
#[derive(Debug, PartialEq, Eq)]
pub enum TimeoutError { InvalidNumber, OutOfRange(u32) }
pub fn bounded_timeout(text: &str) -> Result<u32, TimeoutError> {
    let timeout = text.parse::<u32>().map_err(|_| TimeoutError::InvalidNumber)?;
    if timeout > 60 { return Err(TimeoutError::OutOfRange(timeout)); }
    Ok(timeout)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parse_success_and_failure_are_result_variants() {
        assert_eq!(parse_timeout("15").unwrap(), 15);
        assert!(parse_timeout("abc").is_err());
    }
    #[test]
    fn error_mapping_preserves_business_failure_categories() {
        assert_eq!(bounded_timeout("0"), Ok(0));
        assert_eq!(bounded_timeout("61"), Err(TimeoutError::OutOfRange(61)));
        assert_eq!(bounded_timeout("nan"), Err(TimeoutError::InvalidNumber));
    }
}
