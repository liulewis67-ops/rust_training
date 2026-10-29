//! M08-L02: Fn/FnMut/FnOnce are derived from what captured values do.
pub fn call_twice<F: Fn() -> usize>(callback: F) -> (usize, usize) {
    (callback(), callback())
}
pub fn mutating_pair<F: FnMut() -> u32>(mut callback: F) -> (u32, u32) {
    (callback(), callback())
}
pub fn consume_once<F: FnOnce() -> String>(callback: F) -> String {
    callback()
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn move_of_a_read_only_capture_still_allows_fn_calls() {
        let name = String::from("cache");
        let size = move || name.len();
        assert_eq!(call_twice(size), (5, 5));
    }
    #[test]
    fn mutated_capture_is_fnmut_and_preserves_call_order() {
        let mut count = 0;
        let increment = || { count += 1; count };
        assert_eq!(mutating_pair(increment), (1, 2));
        assert_eq!(count, 2);
    }
    #[test]
    fn consuming_a_captured_string_supports_fnonce() {
        let payload = String::from("payload");
        let once = move || payload;
        assert_eq!(consume_once(once), "payload");
    }
}
