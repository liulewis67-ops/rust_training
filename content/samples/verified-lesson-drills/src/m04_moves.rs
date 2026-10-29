//! M04-L02: move-in, move-out and a borrowed alternative.
pub fn consume_and_tag(mut owned: String) -> String {
    owned.push_str(" done");
    owned
}
pub fn borrowed_byte_count(source: &str) -> usize { source.len() }
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn moving_into_and_out_of_a_function_transfers_ownership_once() {
        let original = String::from("job");
        let result = consume_and_tag(original);
        assert_eq!(result, "job done");
    }
    #[test]
    fn borrowing_does_not_consume_the_original_binding() {
        let original = String::from("你好");
        assert_eq!(borrowed_byte_count(&original), 6);
        assert_eq!(original, "你好");
    }
}
