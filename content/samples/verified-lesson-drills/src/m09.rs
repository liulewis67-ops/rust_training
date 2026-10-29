//! M09-L02 — error category, context, and source are separate contracts.

use std::{error::Error, fmt, num::ParseIntError};

#[derive(Debug)]
pub enum ConfigError {
    Missing { line: usize },
    Invalid { line: usize, cause: ParseIntError },
}

impl fmt::Display for ConfigError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Missing { line } => write!(formatter, "line {line}: missing port"),
            Self::Invalid { line, .. } => write!(formatter, "line {line}: invalid port"),
        }
    }
}

impl Error for ConfigError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Missing { .. } => None,
            Self::Invalid { cause, .. } => Some(cause),
        }
    }
}

pub fn parse_port(line: usize, raw: Option<&str>) -> Result<u16, ConfigError> {
    let raw = raw.ok_or(ConfigError::Missing { line })?;
    raw.parse::<u16>()
        .map_err(|cause| ConfigError::Invalid { line, cause })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn success_preserves_numeric_value() {
        assert_eq!(parse_port(3, Some("8080")).unwrap(), 8080);
    }

    #[test]
    fn invalid_number_has_location_and_parse_error_source() {
        let error = parse_port(12, Some("wide")).unwrap_err();
        assert_eq!(error.to_string(), "line 12: invalid port");
        assert!(matches!(error, ConfigError::Invalid { line: 12, .. }));
        assert!(
            Error::source(&error)
                .and_then(|source| source.downcast_ref::<ParseIntError>())
                .is_some()
        );
    }

    #[test]
    fn absent_value_has_context_but_no_low_level_parse_source() {
        let error = parse_port(13, None).unwrap_err();
        assert_eq!(error.to_string(), "line 13: missing port");
        assert!(matches!(error, ConfigError::Missing { line: 13 }));
        assert!(Error::source(&error).is_none());
    }
}
