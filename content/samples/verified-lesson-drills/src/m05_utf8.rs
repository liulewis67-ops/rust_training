//! M05-L03: byte indices are not Unicode scalar indices.
pub fn first_token(text: &str) -> &str {
    text.split_whitespace().next().unwrap_or("")
}
pub fn byte_prefix(text: &str, end_byte: usize) -> &str {
    &text[..end_byte]
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn zero_copy_tokens_support_unicode_whitespace() {
        assert_eq!(first_token("中文\u{3000}Rust"), "中文");
        assert_eq!(first_token("alpha\u{2009}beta"), "alpha");
        assert_eq!(first_token(""), "");
    }
    #[test]
    fn byte_length_and_character_count_are_different() {
        assert_eq!("你好".len(), 6);
        assert_eq!("你好".chars().count(), 2);
        assert_eq!("你好".get(..3), Some("你"));
        assert_eq!("你好".get(..1), None);
    }
    #[test]
    #[should_panic(expected = "is not a char boundary")]
    fn invalid_utf8_byte_boundary_panics_when_indexed() {
        let _ = byte_prefix("你好", 1);
    }
}
