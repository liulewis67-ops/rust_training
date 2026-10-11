/// Return the first whitespace-delimited word without copying the input.
fn first_word(text: &str) -> &str {
    text.split_whitespace().next().unwrap_or("")
}

#[cfg(test)]
mod tests {
    use super::first_word;

    /// Verify that a normal sentence returns its first word.
    #[test]
    fn returns_first_word() {
        assert_eq!(first_word("Rust ownership"), "Rust");
    }

    /// Verify that Unicode whitespace is handled as a word boundary.
    #[test]
    fn handles_tab_separator() {
        assert_eq!(first_word("Rust\townership"), "Rust");
    }

    /// Verify that empty input produces an empty slice.
    #[test]
    fn handles_empty_input() {
        assert_eq!(first_word(""), "");
    }
}
