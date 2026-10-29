//! M05-L04: keep a borrowed view shorter than a mutation of its owner.
pub fn append_and_measure(items: &mut Vec<String>, next: String) -> Option<(usize, usize)> {
    let first_bytes = items.first()?.len();
    items.push(next);
    Some((first_bytes, items.len()))
}
pub fn append_and_relookup(items: &mut Vec<String>, next: String) -> Option<&str> {
    if items.is_empty() { return None; }
    let first_index = 0;
    items.push(next);
    items.get(first_index).map(String::as_str)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn a_summary_does_not_hold_an_element_reference_across_push() {
        let mut items = vec!["任务".to_string()];
        assert_eq!(append_and_measure(&mut items, "done".into()), Some((6, 2)));
        assert_eq!(items, ["任务", "done"]);
    }
    #[test]
    fn an_empty_queue_does_not_panic_or_mutate() {
        let mut items = Vec::new();
        assert_eq!(append_and_measure(&mut items, "new".into()), None);
        assert!(items.is_empty());
    }
    #[test]
    fn a_fresh_borrow_after_mutation_is_legal() {
        let mut items = vec!["first".to_string()];
        assert_eq!(append_and_relookup(&mut items, "second".into()), Some("first"));
        assert_eq!(items.len(), 2);
    }
}
