/// Incorrectly treats only the ASCII space as a word boundary.
fn first_word(text: &str) -> &str {
    text.split(' ').next().unwrap_or("")
}

#[cfg(test)]
mod tests {
    use super::first_word;

    /// This assertion catches the implementation's failure on tab whitespace.
    #[test]
    fn handles_tab_separator() {
        assert_eq!(first_word("Rust\townership"), "Rust");
    }
}
