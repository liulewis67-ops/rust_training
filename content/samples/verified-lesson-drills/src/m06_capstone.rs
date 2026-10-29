//! M06-L05: borrowed vs owned config. M06-L06: independent Cow normalization.
use std::borrow::Cow;
#[derive(Debug, PartialEq, Eq)]
pub struct ConfigView<'a> { pub key: &'a str, pub value: &'a str }
#[derive(Debug, PartialEq, Eq)]
pub struct Config { pub key: String, pub value: String }
pub fn parse_view(line: &str) -> Option<ConfigView<'_>> {
    let (key, value) = line.split_once('=')?;
    Some(ConfigView { key, value })
}
pub fn parse_owned(line: &str) -> Option<Config> {
    let view = parse_view(line)?;
    Some(Config { key: view.key.to_owned(), value: view.value.to_owned() })
}
pub fn queued_config() -> Config {
    let local = String::from("MODE=cache");
    parse_owned(&local).expect("test fixture has an = separator")
}
pub fn normalize_topic(topic: &str) -> Cow<'_, str> {
    if let Some(rest) = topic.strip_prefix('#') {
        Cow::Borrowed(rest)
    } else {
        Cow::Owned(format!("#{topic}"))
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn l05_borrowed_and_owned_parsing_agree_on_every_boundary() {
        for input in ["MODE=cache", "=", "=cache", "MODE=", "key=a=b", "中文=值"] {
            let view = parse_view(input).unwrap();
            let owned = parse_owned(input).unwrap();
            assert_eq!(view.key, owned.key);
            assert_eq!(view.value, owned.value);
            assert_eq!(view.key.as_ptr(), input.as_ptr());
        }
        assert_eq!(parse_view("missing"), None);
        assert_eq!(parse_owned("missing"), None);
        assert_eq!(queued_config(), Config { key: "MODE".into(), value: "cache".into() });
    }
    #[test]
    fn l06_cow_variants_and_utf8_source_are_part_of_the_contract() {
        for (input, expected) in [("rust", "#rust"), ("", "#"), ("你好", "#你好")] {
            assert_eq!(normalize_topic(input), Cow::<str>::Owned(expected.into()));
            assert!(matches!(normalize_topic(input), Cow::Owned(_)));
        }
        for (input, expected) in [("#rust", "rust"), ("##rust", "#rust"), ("#你好", "你好")] {
            let result = normalize_topic(input);
            assert_eq!(result.as_ref(), expected);
            match result {
                Cow::Borrowed(view) => assert_eq!(view.as_ptr(), input[1..].as_ptr()),
                Cow::Owned(_) => panic!("a prefixed value should return a borrowed suffix"),
            }
        }
    }
}
