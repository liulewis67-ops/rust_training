//! M06-L03: borrowed views and queue-ready owned objects serve different lifetimes.
#[derive(Debug, PartialEq, Eq)]
pub struct AlertView<'a> { pub code: &'a str, pub detail: &'a str }
#[derive(Debug, PartialEq, Eq)]
pub struct Alert { pub code: String, pub detail: String }
pub fn view_alert(text: &str) -> Option<AlertView<'_>> {
    let (code, detail) = text.split_once('|')?;
    Some(AlertView { code, detail })
}
pub fn own_alert(text: &str) -> Option<Alert> {
    let view = view_alert(text)?;
    Some(Alert { code: view.code.to_owned(), detail: view.detail.to_owned() })
}
pub fn make_owned_alert() -> Alert {
    own_alert("R20|worker restarted").expect("known fixture contains a separator")
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn the_view_borrows_without_consuming_the_input() {
        let text = String::from("R20|worker restarted");
        let view = view_alert(&text).unwrap();
        assert_eq!(view.code, "R20");
        assert_eq!(view.detail, "worker restarted");
        assert_eq!(text.len(), 20);
    }
    #[test]
    fn owned_data_survives_after_a_temporary_source_is_dropped() {
        let alert = {
            let raw = String::from("R20|worker restarted");
            own_alert(&raw).unwrap()
        };
        assert_eq!(alert, make_owned_alert());
    }
    #[test]
    fn malformed_text_does_not_panic_or_construct_partial_data() {
        assert_eq!(view_alert("no separator"), None);
        assert_eq!(own_alert("no separator"), None);
        assert_eq!(view_alert("|"), Some(AlertView { code: "", detail: "" }));
    }
}
