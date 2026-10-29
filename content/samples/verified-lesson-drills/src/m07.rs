//! M07-L02 — the associated output type is fixed by each implementation.

use std::fmt::Display;

pub trait Summary {
    type Output: Display;
    fn summarize(&self) -> Self::Output;
}

pub struct QueueItem {
    pub id: u32,
}

pub struct ImportBatch {
    pub accepted: u32,
}

impl Summary for QueueItem {
    type Output = String;

    fn summarize(&self) -> Self::Output {
        format!("Q{}", self.id)
    }
}

impl Summary for ImportBatch {
    type Output = u32;

    fn summarize(&self) -> Self::Output {
        self.accepted
    }
}

pub fn render_summary<T: Summary>(value: &T) -> String {
    value.summarize().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn one_generic_function_supports_distinct_output_types() {
        assert_eq!(render_summary(&QueueItem { id: 17 }), "Q17");
        assert_eq!(render_summary(&ImportBatch { accepted: 8 }), "8");
    }
}
