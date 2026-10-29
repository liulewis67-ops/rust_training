//! M02-L03: inclusive range bounds and loop termination are observable contracts.
pub fn sum_inclusive(n: u32) -> u32 {
    (1..=n).sum()
}
pub fn sum_exclusive(n: u32) -> u32 {
    (1..n).sum()
}
pub fn countdown(mut remaining: u32) -> u32 {
    let mut ticks = 0;
    while remaining > 0 {
        remaining -= 1;
        ticks += 1;
    }
    ticks
}
pub fn first_even_at_or_after(mut value: u32) -> u32 {
    loop {
        if value.is_multiple_of(2) { break value; }
        value += 1;
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn inclusive_upper_bound_changes_a_calculation() {
        assert_eq!(sum_inclusive(0), 0);
        assert_eq!(sum_inclusive(1), 1);
        assert_eq!(sum_inclusive(3), 6);
        assert_eq!(sum_exclusive(3), 3);
    }
    #[test]
    fn a_while_loop_must_progress_to_termination() {
        assert_eq!(countdown(0), 0);
        assert_eq!(countdown(3), 3);
        assert_eq!(countdown(7), 7);
    }
    #[test]
    fn loop_can_produce_a_value_with_break() {
        assert_eq!(first_even_at_or_after(5), 6);
        assert_eq!(first_even_at_or_after(4), 4);
    }
}
