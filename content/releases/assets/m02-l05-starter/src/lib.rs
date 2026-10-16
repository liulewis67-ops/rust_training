//! Converts whole-minute text input into an exact number of seconds.

/// Converts unsigned whole minutes to seconds, reporting invalid input or overflow.
pub fn minutes_to_seconds(input: &str) -> Result<u64, &'static str> {
    // TODO: parse the text, then detect multiplication overflow.
    let minutes: u64 = input;
    let seconds = minutes * 60;
    Ok(seconds)
}
