//! M06-L01: return a slice only when its owner lives outside the function.
pub fn before_delimiter(source: &str) -> &str {
    source.split_once(':').map(|(left, _)| left).unwrap_or(source)
}
pub fn independent_prefix(source: &str) -> String {
    before_delimiter(source).to_owned()
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn borrowed_view_comes_from_the_callers_still_live_string() {
        let source = String::from("mode:cache");
        let view = before_delimiter(&source);
        assert_eq!(view, "mode");
        assert_eq!(view.as_ptr(), source.as_ptr());
        assert_eq!(before_delimiter("plain"), "plain");
    }
    #[test]
    fn owned_output_can_escape_the_source_scope_safely() {
        let owned = {
            let source = String::from("mode:cache");
            independent_prefix(&source)
        };
        assert_eq!(owned, "mode");
        assert_eq!(independent_prefix(""), "");
    }
}
