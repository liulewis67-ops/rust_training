//! M09-L03: business errors are independent of CLI and API presentation.
use std::{error::Error, fmt, io};
#[derive(Debug)]
pub enum CoreError { InvalidPort, ProfileNotFound, Storage(io::Error) }
impl fmt::Display for CoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidPort => f.write_str("invalid port"),
            Self::ProfileNotFound => f.write_str("profile not found"),
            Self::Storage(_) => f.write_str("storage unavailable"),
        }
    }
}
impl Error for CoreError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self { Self::Storage(cause) => Some(cause), _ => None }
    }
}
#[derive(Debug, PartialEq, Eq)]
pub struct CliFailure { pub exit_code: u8, pub message: &'static str }
#[derive(Debug, PartialEq, Eq)]
pub struct ApiFailure { pub status: u16, pub code: &'static str, pub message: &'static str }
pub fn map_cli(error: &CoreError) -> CliFailure {
    match error {
        CoreError::InvalidPort => CliFailure { exit_code: 2, message: "invalid port" },
        CoreError::ProfileNotFound => CliFailure { exit_code: 3, message: "profile not found" },
        CoreError::Storage(_) => CliFailure { exit_code: 1, message: "storage unavailable" },
    }
}
pub fn map_api(error: &CoreError) -> ApiFailure {
    match error {
        CoreError::InvalidPort => ApiFailure { status: 400, code: "invalid_port", message: "invalid port" },
        CoreError::ProfileNotFound => ApiFailure { status: 404, code: "profile_not_found", message: "profile not found" },
        CoreError::Storage(_) => ApiFailure { status: 500, code: "internal_error", message: "internal server error" },
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn both_boundaries_map_each_domain_error_without_changing_core_type() {
        let cases = [
            (CoreError::InvalidPort, 2, 400, "invalid_port"),
            (CoreError::ProfileNotFound, 3, 404, "profile_not_found"),
            (CoreError::Storage(io::Error::other("secret-server-credentials")), 1, 500, "internal_error"),
        ];
        for (core, cli, api, code) in &cases {
            assert_eq!(map_cli(core).exit_code, *cli);
            assert_eq!(map_api(core).status, *api);
            assert_eq!(map_api(core).code, *code);
        }
    }
    #[test]
    fn public_error_does_not_expose_underlying_storage_details() {
        let error = CoreError::Storage(io::Error::other("secret-server-credentials"));
        let public = map_api(&error);
        assert_eq!(public.message, "internal server error");
        assert!(!public.message.contains("secret"));
        assert!(Error::source(&error).unwrap().to_string().contains("secret"));
        assert_eq!(map_cli(&error).message, "storage unavailable");
    }
}
