//! M01-L02: Cargo package identity is distinct from the Rust edition and compiler.
pub fn package_identity() -> (&'static str, &'static str) {
    (env!("CARGO_PKG_NAME"), env!("CARGO_PKG_VERSION"))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cargo_injects_package_name_and_version_from_manifest() {
        assert_eq!(package_identity(), ("rust-path-verified-lesson-drills", "0.1.0"));
    }
    #[test]
    fn manifest_location_belongs_to_the_package_not_rustup() {
        let manifest_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
        assert!(manifest_dir.join("Cargo.toml").is_file());
        assert!(manifest_dir.join("src/lib.rs").is_file());
    }
}
