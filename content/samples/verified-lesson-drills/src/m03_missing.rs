//! M03-L03: Some("") is a present value and must never be conflated with None.
pub fn ticket_title(code: u16) -> Option<&'static str> {
    match code {
        10 => Some("standard"),
        20 => Some(""),
        _ => None,
    }
}
pub fn describe_title(code: u16) -> String {
    match ticket_title(code) {
        Some("") => "present but blank".into(),
        Some(value) => format!("title: {value}"),
        None => "unknown ticket".into(),
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn missing_and_empty_are_distinct_variants() {
        assert_eq!(ticket_title(20), Some(""));
        assert_eq!(ticket_title(99), None);
        assert_ne!(ticket_title(20), ticket_title(99));
    }
    #[test]
    fn all_query_paths_are_handled_explicitly() {
        assert_eq!(describe_title(10), "title: standard");
        assert_eq!(describe_title(20), "present but blank");
        assert_eq!(describe_title(99), "unknown ticket");
    }
}
