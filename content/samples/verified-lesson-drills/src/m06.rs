//! M06-L02 — a returned view borrows text, not the search query.

pub fn find_token<'text>(text: &'text str, query: &str) -> Option<&'text str> {
    text.split_whitespace().find(|token| *token == query)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_is_borrowed_from_the_longer_lived_input() {
        let text = String::from("alpha beta gamma");
        let result;
        {
            let temporary_query = String::from("beta");
            result = find_token(&text, &temporary_query);
        } // The query ends here, but the view depends only on text.
        assert_eq!(result, Some("beta"));
    }

    #[test]
    fn matching_uses_whole_unicode_separated_tokens() {
        assert_eq!(find_token("红\u{3000}蓝", "蓝"), Some("蓝"));
        assert_eq!(find_token("alphabet", "alpha"), None);
        assert_eq!(find_token("", "alpha"), None);
    }
}
