//! M08-L01: indexed sequences and keyed maps serve distinct contracts.
use std::collections::HashMap;
pub fn safe_item<T>(items: &[T], index: usize) -> Option<&T> { items.get(index) }
pub fn keyed_report(rows: &[(&str, u32)]) -> Vec<(String, u32)> {
    let mut data = HashMap::new();
    for &(key, value) in rows { data.insert(key.to_owned(), value); }
    let mut output: Vec<_> = data.into_iter().collect();
    output.sort_unstable_by(|a, b| a.0.cmp(&b.0));
    output
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn vector_lookup_handles_empty_and_first_invalid_index() {
        assert_eq!(safe_item::<u32>(&[], 0), None);
        assert_eq!(safe_item(&[10, 20], 1), Some(&20));
        assert_eq!(safe_item(&[10, 20], 2), None);
    }
    #[test]
    fn duplicate_map_keys_replace_and_explicit_sort_is_deterministic() {
        let rows = [("web", 1), ("api", 2), ("web", 9)];
        assert_eq!(keyed_report(&rows), vec![("api".into(), 2), ("web".into(), 9)]);
        assert!(keyed_report(&[]).is_empty());
        assert_eq!(keyed_report(&[("中文", 3)]), vec![("中文".into(), 3)]);
    }
}
