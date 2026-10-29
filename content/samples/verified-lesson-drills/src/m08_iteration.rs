//! M08-L03: iter, iter_mut and into_iter have different item ownership.
pub fn lengths(values: &[String]) -> Vec<usize> {
    values.iter().map(String::len).collect()
}
pub fn normalize_in_place(values: &mut [String]) {
    for value in values.iter_mut() { value.make_ascii_lowercase(); }
}
pub fn transfer(values: Vec<String>) -> Vec<String> {
    values.into_iter().map(|item| format!("owned:{item}")).collect()
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn iter_borrows_and_leaves_original_values_usable() {
        let values = vec!["RED".into(), "BLUE".into()];
        assert_eq!(lengths(&values), vec![3, 4]);
        assert_eq!(values[0], "RED");
    }
    #[test]
    fn iter_mut_modifies_items_but_retains_the_vector() {
        let mut values = vec!["RED".into(), "Blue".into()];
        normalize_in_place(&mut values);
        assert_eq!(values, ["red", "blue"]);
    }
    #[test]
    fn into_iter_transfers_owned_values_without_clone_requirements() {
        let source = vec!["one".into(), "two".into()];
        let changed = transfer(source);
        assert_eq!(changed, ["owned:one", "owned:two"]);
    }
}
