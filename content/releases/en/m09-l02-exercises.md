# M09-L02 Exercises: Custom errors and original causes

> **Exercise path:** Predict → repair → implement. Verify typed causes and stable location messages using local Rust 1.95.0 / Edition 2024.

## Learning goals and order

Work with the `ConfigError` and `PortProblem` from the lesson. A stable display message serves the user; a wrapped `ParseIntError` serves controlled diagnostics. Keep those responsibilities separate.

## 1. Predict: summary, line, and source

Consider `parse_port_field(12, Some("wide"))`, `parse_port_field(13, None)`, and the original `Error::source()` implementation.

1. What is the outer display for the malformed port at line 12?
2. Does its `source()` return `Some` or `None`, and what is the concrete wrapped error?
3. Does a missing field at line 13 have a parser source? Explain why.

**Acceptance:** Invalid digits display `line 12: invalid port value` and retain `Some(ParseIntError)`; missing data has `None` because no numeric parse was attempted.

## 2. Repair: the source chain was discarded

The `LocatedParseError` still stores `ParseIntError`, but its `Error::source()` always returns `None`. Change it to return a borrowed reference to the original cause.

**Hint:** Return `Some(&self.cause)` as an `Error` trait object. Do not move the cause, convert it to a string, or return `self` and create a circular chain.

**Acceptance:** The initial code compiles but fails its source-chain assertion. The repaired type keeps the same stable `Display` and allows downcasting the source to `ParseIntError`.

~~~rust
use std::error::Error;
use std::fmt;
use std::num::ParseIntError;

/// Wraps a parser failure with its source line.
#[derive(Debug)]
struct LocatedParseError {
    /// Stores the one-based line where parsing failed.
    line: usize,
    /// Retains the original standard-library parse error.
    cause: ParseIntError,
}

/// Shows stable context without flattening the nested source.
impl fmt::Display for LocatedParseError {
    /// Formats the line location and error category.
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "line {}: invalid integer", self.line)
    }
}

/// Implements Error but currently hides the wrapped cause.
impl Error for LocatedParseError {
    /// TODO: expose cause as the lower-level source.
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        None
    }
}

/// Checks that the source chain retains the parser error type.
fn main() {
    let cause = "oops".parse::<u16>().unwrap_err();
    let error = LocatedParseError { line: 5, cause };
    assert_eq!(error.to_string(), "line 5: invalid integer");
    assert!(
        Error::source(&error)
            .and_then(|source| source.downcast_ref::<ParseIntError>())
            .is_some()
    );
}
~~~

## 3. Implement: attach a line to a parse result

Complete `attach_line(line, parsed)` so `Ok` passes through unchanged and `Err(ParseIntError)` becomes `Err(LocatedParseError { line, cause })`.

**Hint:** `Result::map_err` transforms only the error branch.

**Acceptance:** `Ok(8080)` stays `Ok(8080)`; malformed text produces the expected line number and a real parser source. Returning just a formatted error string does not meet the contract.

~~~rust
use std::error::Error;
use std::fmt;
use std::num::ParseIntError;

/// Wraps a parser failure with its source line.
#[derive(Debug)]
struct LocatedParseError {
    /// Stores the one-based line where parsing failed.
    line: usize,
    /// Retains the original standard-library parse error.
    cause: ParseIntError,
}

/// Shows stable context without flattening the nested source.
impl fmt::Display for LocatedParseError {
    /// Formats the line location and error category.
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "line {}: invalid integer", self.line)
    }
}

/// Exposes the lower-level parser error.
impl Error for LocatedParseError {
    /// Returns the retained parse error as the source.
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        Some(&self.cause)
    }
}

/// Adds an input line to a parse result without changing the success value.
fn attach_line(
    line: usize,
    parsed: Result<u16, ParseIntError>,
) -> Result<u16, LocatedParseError> {
    // TODO: Keep Ok unchanged and wrap Err with line context.
    todo!()
}

/// Checks successful values and nested error context.
fn main() {
    assert!(matches!(attach_line(2, "8080".parse::<u16>()), Ok(8080)));

    let error = attach_line(9, "wide".parse::<u16>()).unwrap_err();
    assert_eq!(error.line, 9);
    assert_eq!(error.to_string(), "line 9: invalid integer");
    assert!(
        Error::source(&error)
            .and_then(|source| source.downcast_ref::<ParseIntError>())
            .is_some()
    );
}
~~~

## Self-check list

- [ ] A missing field and an invalid numeric field have different source-chain behavior.
- [ ] The outer message contains stable position and category information without leaking the original user value.
- [ ] `source()` returns the stored lower-level object rather than an already formatted string.

Verify through actual assertions.

## Reference answers

1. Malformed port on line 12 displays `line 12: invalid port value` and wraps a `ParseIntError`. Missing data has no parser source.
2. The corrected `Error::source` returns a reference to the actual `cause`.
3. `map_err` attaches the known line number while preserving the original error object.

`Display` is a concise public summary; `source()` is the inspectable causal link. Do not stringify the cause before storing it.

   ```rust
   impl std::error::Error for LocatedParseError {
       fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
           Some(&self.cause)
       }
   }
   ```

   ```rust
   fn attach_line(
       line: usize,
       parsed: Result<u16, std::num::ParseIntError>,
   ) -> Result<u16, LocatedParseError> {
       parsed.map_err(|cause| LocatedParseError { line, cause })
   }
   ```

## Sources

Use the Rust Book's error handling chapter to cross-check propagation, wrapping, and return contracts.

- [The Rust Programming Language: Error Handling](https://doc.rust-lang.org/book/ch09-00-error-handling.html)
