//! M02-L04: arrays have fixed lengths; get is checked, indexing may panic.
pub fn sum_three(values: [i32; 3]) -> i32 {
    values.iter().sum()
}
pub fn safe_read(values: &[i32], index: usize) -> Option<i32> {
    values.get(index).copied()
}
pub fn index_direct(values: &[i32], index: usize) -> i32 {
    values[index]
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn fixed_array_and_tuple_are_distinct_shapes() {
        let (name, count) = ("sensor", 3_u8);
        assert_eq!((name, count), ("sensor", 3));
        assert_eq!(sum_three([4, 7, 2]), 13);
    }
    #[test]
    fn get_reports_missing_indices_including_len() {
        assert_eq!(safe_read(&[4, 7, 2], 2), Some(2));
        assert_eq!(safe_read(&[4, 7, 2], 3), None);
        assert_eq!(safe_read(&[], 0), None);
    }
    #[test]
    #[should_panic(expected = "index out of bounds")]
    fn direct_out_of_range_index_panics_at_runtime() {
        let _ = index_direct(&[4, 7, 2], 3);
    }
}
