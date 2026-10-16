/// Returns the sum of two small unsigned integers.
pub fn add(left: u32, right: u32) -> u32 {
    left + right
}

#[cfg(test)]
mod tests {
    use super::add;

    /// Checks the expected result of adding two and two.
    #[test]
    fn adds_two_and_two() {
        assert_eq!(add(2, 2), 5);
    }
}
