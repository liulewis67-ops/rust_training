//! M04-L05: repair a moved String while preserving two outputs.
//! M04-L06: a different ticket interface reads bytes before consuming ownership.
fn add_badge(source: String) -> String { format!("[ready] {source}") }
fn append_period(source: String) -> String { format!("{source}.") }
pub fn render(source: String) -> (String, String) {
    let processed = append_period(add_badge(source.clone()));
    (source, processed)
}
fn render_ticket(source: String) -> String { format!("[ticket] {source}") }
pub fn publish_ticket(source: String) -> (usize, String) {
    let bytes = source.len();
    (bytes, render_ticket(source))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn l05_original_and_both_pipeline_stages_are_preserved() {
        assert_eq!(render("build complete".into()),
            ("build complete".into(), "[ready] build complete.".into()));
        assert_eq!(render("".into()), ("".into(), "[ready] .".into()));
        assert_eq!(render("你好".into()), ("你好".into(), "[ready] 你好.".into()));
    }
    #[test]
    fn l06_independent_ticket_audit_preserves_utf8_byte_lengths() {
        assert_eq!(publish_ticket("build".into()), (5, "[ticket] build".into()));
        assert_eq!(publish_ticket("".into()), (0, "[ticket] ".into()));
        assert_eq!(publish_ticket("é".into()), (2, "[ticket] é".into()));
        assert_eq!(publish_ticket("你好".into()), (6, "[ticket] 你好".into()));
    }
}
