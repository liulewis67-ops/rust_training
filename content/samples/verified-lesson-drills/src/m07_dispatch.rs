//! M07-L03: static generic calls and heterogeneous dynamic trait-object lists.
pub trait Label { fn label(&self) -> String; }
pub struct QueueItem(pub u32);
pub struct ImportBatch(pub u32);
impl Label for QueueItem { fn label(&self) -> String { format!("Q{}", self.0) } }
impl Label for ImportBatch { fn label(&self) -> String { format!("accepted:{}", self.0) } }
pub fn static_label<T: Label>(value: &T) -> String { value.label() }
pub fn dynamic_label(value: &dyn Label) -> String { value.label() }
pub fn render_all(items: &[Box<dyn Label>]) -> Vec<String> {
    items.iter().map(|item| item.label()).collect()
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn static_and_dynamic_dispatch_preserve_the_same_behavior() {
        let task = QueueItem(7);
        assert_eq!(static_label(&task), "Q7");
        assert_eq!(dynamic_label(&task), "Q7");
    }
    #[test]
    fn a_trait_object_collection_supports_heterogeneous_items() {
        let items: Vec<Box<dyn Label>> =
            vec![Box::new(QueueItem(17)), Box::new(ImportBatch(8))];
        assert_eq!(render_all(&items), ["Q17", "accepted:8"]);
    }
    #[test]
    fn no_items_produce_an_empty_report() {
        let items: Vec<Box<dyn Label>> = Vec::new();
        assert!(render_all(&items).is_empty());
    }
}
