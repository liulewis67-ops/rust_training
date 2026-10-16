/// Returns the name using lowercase characters.
pub fn normalize_name(name: &str) -> String {
    name.to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::normalize_name;

    /// Checks normalization of a mixed-case name.
    #[test]
    fn lowercases_a_mixed_case_name() {
        assert_eq!(normalize_name("Rustacean"), "rustacean");
    }
}
