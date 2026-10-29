//! M05-L01: overlapping shared reads are valid; an exclusive writer comes afterward.
pub fn audit_then_mark(mut record: String) -> (usize, String) {
    let (a, b) = (&record, &record);
    let length = a.len();
    assert_eq!(a, b);
    record.push('!');
    (length, record)
}
pub fn append_owned(record: &mut String, suffix: &str) { record.push_str(suffix); }
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn two_readers_then_one_writer_preserve_both_contracts() {
        assert_eq!(audit_then_mark("ready".into()), (5, "ready!".into()));
        assert_eq!(audit_then_mark("中".into()), (3, "中!".into()));
    }
    #[test]
    fn exclusive_borrow_does_not_move_the_owner() {
        let mut source = String::from("one");
        append_owned(&mut source, "-two");
        assert_eq!(source, "one-two");
    }
}
