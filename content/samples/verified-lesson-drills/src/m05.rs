//! M05-L02 — the last use of an element borrow precedes vector mutation.

pub fn append_after_read(queue: &mut Vec<String>, next: String) -> (usize, usize) {
    assert!(!queue.is_empty(), "the caller must provide a nonempty queue");
    let first = &queue[0];
    let first_byte_count = first.len(); // Last use: the shared borrow ends here.
    queue.push(next); // Now the mutable borrow is exclusive.
    (first_byte_count, queue.len())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_read_then_push_keeps_the_queue_usable() {
        let mut queue = vec![String::from("one")];
        assert_eq!(append_after_read(&mut queue, "two".into()), (3, 2));
        assert_eq!(queue, ["one", "two"]);
    }

    #[test]
    fn utf8_lengths_still_count_bytes() {
        let mut queue = vec![String::from("中")];
        assert_eq!(append_after_read(&mut queue, "next".into()), (3, 2));
    }
}
