//! M04-L03 — moving an owned String differs from making an independent clone.

pub fn append_status(mut text: String) -> String {
    text.push_str(" ready");
    text
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cloning_keeps_a_separate_original() {
        let original = String::from("build");
        let updated = append_status(original.clone());
        assert_eq!(original, "build");
        assert_eq!(updated, "build ready");
    }

    #[test]
    fn copying_a_scalar_keeps_both_bindings_usable() {
        let count = 4_u32;
        let second = count;
        assert_eq!(count + second, 8);
    }

    #[test]
    fn changing_the_clone_does_not_mutate_its_original() {
        let original = String::from("report");
        let mut copy = original.clone();
        copy.push('!');
        assert_eq!(original, "report");
        assert_eq!(copy, "report!");
    }
}
