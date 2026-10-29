//! M09-L04: Result for invalid input; panic is a distinct exceptional path.
#[derive(Debug, PartialEq, Eq)]
pub enum InputError { InvalidNumber, OutOfRange }
pub fn parse_retries(input: &str) -> Result<u8, InputError> {
    let parsed = input.parse::<u16>().map_err(|_| InputError::InvalidNumber)?;
    if parsed > 5 { return Err(InputError::OutOfRange); }
    Ok(parsed as u8)
}
pub fn safe_public_message(error: &InputError) -> &'static str {
    match error {
        InputError::InvalidNumber => "expected a decimal retry count",
        InputError::OutOfRange => "retry count must be from 0 to 5",
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn untrusted_input_remains_recoverable_without_panic() {
        assert_eq!(parse_retries("0"), Ok(0));
        assert_eq!(parse_retries("5"), Ok(5));
        assert_eq!(parse_retries("6"), Err(InputError::OutOfRange));
        assert_eq!(parse_retries("bad"), Err(InputError::InvalidNumber));
        let result = std::panic::catch_unwind(|| parse_retries("bad"));
        assert!(matches!(result, Ok(Err(InputError::InvalidNumber))));
    }
    #[test]
    fn external_messages_do_not_echo_invalid_user_input() {
        let invalid = parse_retries("password=secret").unwrap_err();
        assert_eq!(safe_public_message(&invalid), "expected a decimal retry count");
        assert!(!safe_public_message(&invalid).contains("secret"));
    }
    #[test]
    #[should_panic(expected = "an intentional internal invariant test")]
    fn panic_is_not_the_normal_validation_strategy() {
        panic!("an intentional internal invariant test");
    }
}
