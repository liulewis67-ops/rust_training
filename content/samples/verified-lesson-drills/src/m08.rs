//! M08-L04 — lazy transformations do no work until consumed.

use std::cell::Cell;

pub fn double_with_counter(values: &[i32]) -> (Vec<i32>, usize, usize) {
    let calls = Cell::new(0);
    let pending = values.iter().map(|value| {
        calls.set(calls.get() + 1);
        *value * 2
    });

    let before = calls.get(); // Must be zero: map has not been consumed.
    let doubled: Vec<i32> = pending.collect();
    (doubled, before, calls.get())
}

pub fn even_total(values: &[i32]) -> i32 {
    values
        .iter()
        .filter(|value| **value % 2 == 0)
        .fold(0, |sum, value| sum + value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_map_adapter_runs_only_when_collected() {
        assert_eq!(double_with_counter(&[2, 4, 6]), (vec![4, 8, 12], 0, 3));
        assert_eq!(double_with_counter(&[]), (vec![], 0, 0));
    }

    #[test]
    fn fold_handles_duplicates_negative_even_values_and_empty_input() {
        assert_eq!(even_total(&[2, 2, 3, -6]), -2);
        assert_eq!(even_total(&[]), 0);
    }
}
