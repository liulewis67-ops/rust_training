//! M05-L05: zero-copy query; M05-L06: independent UTF-8-safe separator API.
pub fn find_token<'text>(text: &'text str, query: &str) -> Option<&'text str> {
    text.split_whitespace().find(|token| *token == query)
}
pub fn split_label<'text>(text: &'text str, separator: &str)
    -> Option<(&'text str, &'text str)>
{
    if separator.is_empty() { return None; }
    let start = text.find(separator)?;
    let end = start.checked_add(separator.len())?;
    Some((text.get(..start)?, text.get(end..)?))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn l05_result_is_part_of_text_not_query() {
        let text = String::from("你好 世界");
        let found;
        {
            let query = String::from("世界");
            found = find_token(&text, &query);
            assert_ne!(found.unwrap().as_ptr(), query.as_ptr());
        }
        let found = found.unwrap();
        assert_eq!(found, "世界");
        assert_eq!(found.as_ptr(), text["你好 ".len()..].as_ptr());
        assert_eq!(find_token("", "x"), None);
        assert_eq!(find_token("alpha\u{3000}beta", "beta"), Some("beta"));
    }
    #[test]
    fn l06_utf8_split_uses_byte_aligned_original_slices() {
        for (input, sep, expected) in [
            ("head::tail", "::", Some(("head", "tail"))),
            ("部署：完成", "：", Some(("部署", "完成"))),
            ("东🧭西", "🧭", Some(("东", "西"))),
            ("a::b::c", "::", Some(("a", "b::c"))),
            ("::end", "::", Some(("", "end"))),
            ("begin::", "::", Some(("begin", ""))),
            ("", "::", None),
            ("no match", "::", None),
            ("a=b", "", None),
        ] { assert_eq!(split_label(input, sep), expected); }
        let input = "东🧭西";
        let (left, right) = split_label(input, "🧭").unwrap();
        assert_eq!(left.as_ptr(), input.as_ptr());
        assert_eq!(right.as_ptr(), input["东🧭".len()..].as_ptr());
    }
    #[test]
    fn l06_read_before_mutation_preserves_both_operations() {
        let mut text = String::from("部署：完成");
        let (left, right) = split_label(&text, "：").unwrap();
        let label = format!("{left} / {right}");
        text.push('!');
        assert_eq!(label, "部署 / 完成");
        assert_eq!(text, "部署：完成!");
    }
}
