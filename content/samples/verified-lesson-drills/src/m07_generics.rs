//! M07-L01: a generic function needs the minimum capability it uses.
pub fn greater<T: PartialOrd>(left: T, right: T) -> T {
    if left >= right { left } else { right }
}
pub fn named_pair<T: std::fmt::Display>(left: T, right: T) -> String {
    format!("{left} / {right}")
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn ordering_bound_supports_multiple_concrete_types() {
        assert_eq!(greater(7_i32, 4), 7);
        assert_eq!(greater("aaa", "bbb"), "bbb");
        assert_eq!(greater("equal", "equal"), "equal");
    }
    #[test]
    fn display_bound_is_only_required_where_formatting_is_used() {
        assert_eq!(named_pair(3, 4), "3 / 4");
        assert_eq!(named_pair("a", "b"), "a / b");
    }
}
