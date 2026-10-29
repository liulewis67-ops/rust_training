//! M01-L03: separate a compilation error, a test failure and runtime panic.
pub fn parse_workers(text: &str) -> Result<usize, std::num::ParseIntError> {
    text.parse::<usize>()
}
pub fn doubled(workers: usize) -> usize { workers * 2 }
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn valid_input_is_a_behavioral_assertion() {
        assert_eq!(doubled(parse_workers("3").unwrap()), 6);
        assert_ne!(doubled(3), 3); // A constant or wrong formula violates the contract.
    }
    #[test]
    fn invalid_input_is_reported_without_panicking() {
        assert!(parse_workers("three").is_err());
    }
    #[test]
    #[should_panic(expected = "called `Result::unwrap()` on an `Err` value")]
    fn explicit_unwrap_turns_invalid_input_into_a_runtime_panic() {
        let _ = parse_workers("three").unwrap();
    }
}
