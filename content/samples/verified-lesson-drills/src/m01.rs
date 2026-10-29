//! M01-L04 — a meaningful test must exercise observable behavior.

pub fn normalize_name(name: &str) -> String {
    name.to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mixed_case_input_is_normalized() {
        assert_eq!(normalize_name("RuSt"), "rust");
    }

    #[test]
    fn empty_input_does_not_gain_content() {
        assert_eq!(normalize_name(""), "");
    }

    #[test]
    fn a_constant_output_would_violate_the_contract() {
        let wrong_implementation = |_name: &str| String::from("rust");
        assert_ne!(wrong_implementation("Go"), normalize_name("Go"));
    }
}
