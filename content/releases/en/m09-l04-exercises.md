# M09-L04 Exercises: Panic, normal errors, and redacted messages

> **Exercise path:** Predict → repair → implement → design review. Do not use a panic catcher as a substitute for routine Result-based control flow.

## Learning goals and order

Record your expected error result and recovery boundary first, then run the examples using Rust 1.95.0 / Edition 2024. Treat ordinary malformed input and violated invariants as different kinds of failure.

## 1. Repair: user input must not panic

The original `parse_limit` calls `expect` on user-supplied text. Change its signature and implementation to return `Result<u16, ParseIntError>`, preserving the original error on malformed input.

**Hint:** `raw.trim().parse::<u16>()` already returns the required `Result`. Do not call `expect`, `unwrap`, or catch an avoidable panic.

**Acceptance:** The starter panics on invalid input, so the surrounding `catch_unwind` observes `Err` and its assertion fails. After the fix the parse returns `Err(ParseIntError)` *normally*, so the closure finishes without panicking.

~~~rust
/// Parses a user-provided limit but panics when input is invalid.
fn parse_limit(raw: &str) -> u16 {
    raw.trim()
        .parse::<u16>()
        .expect("invalid limit from private request")
}

/// Checks that invalid input is returned rather than panicking.
fn main() {
    let observed = std::panic::catch_unwind(|| parse_limit("not-a-number"));
    assert!(observed.is_ok());
}
~~~

## 2. Implement: public error text and diagnostic category

Implement `public_message` for two `RequestError` variants. Invalid limits should produce `limit must be an unsigned 16-bit integer`; storage failures should produce `request could not be completed`. Keep `diagnostic_code` available for controlled logs.

**Hint:** Match on the enum variant and return a static, stable message. Do not concatenate raw input, `source()` details, or internal file paths into public output.

**Acceptance:** The two public messages remain distinct; simulated private path text is absent and `Storage` retains diagnostic code `storage_failure`.

~~~rust
use std::io;
use std::num::ParseIntError;

/// Preserves expected input errors and unexpected storage failures.
#[derive(Debug)]
enum RequestError {
    /// The request supplied a limit that cannot be parsed as u16.
    InvalidLimit(ParseIntError),
    /// The request could not be completed because storage failed.
    Storage(io::Error),
}

/// Chooses a stable message that is safe to show to a request user.
fn public_message(error: &RequestError) -> &'static str {
    // TODO: Return a distinct safe message for each category.
    todo!()
}

/// Gives each failure class a stable internal diagnostic category.
fn diagnostic_code(error: &RequestError) -> &'static str {
    match error {
        RequestError::InvalidLimit(_) => "invalid_limit",
        RequestError::Storage(_) => "storage_failure",
    }
}

/// Checks that public messages are useful without exposing private details.
fn main() {
    let invalid = RequestError::InvalidLimit("private-token".parse::<u16>().unwrap_err());
    let storage = RequestError::Storage(io::Error::new(
        io::ErrorKind::PermissionDenied,
        "private filesystem path",
    ));
    assert_eq!(
        public_message(&invalid),
        "limit must be an unsigned 16-bit integer"
    );
    assert_eq!(public_message(&storage), "request could not be completed");
    assert_eq!(diagnostic_code(&storage), "storage_failure");
    assert!(!public_message(&storage).contains("private filesystem path"));
}
~~~

## 3. Design review: where could panic isolation be appropriate?

A hypothetical HTTP handler wraps every request in `catch_unwind` and, even after catching a panic, responds with an empty successful result and the raw panic payload. Review this design:

1. Which conditions belong in `Result` instead?
2. What happens with `panic=abort`? Does the panic hook execute before a catch?
3. If isolating an extension/plugin, how do you prove shared invariants remain safe before continuing?
4. What should a caller see, and what may controlled diagnostics retain?

**Acceptance:** Routine input and dependency failures use `Result`; an aborting panic cannot be caught; a hook may still run; catching an unwinding panic does not automatically undo side effects or restore invariants. Public messages must be sanitized while controlled diagnostic data remains appropriately protected.

## Self-check list

- [ ] Invalid user input is handled with `Result`, not panic.
- [ ] I understand unwind/abort and why `catch_unwind` is not general business recovery.
- [ ] Public output excludes raw internal secrets and controlled diagnostics are separately protected.

Check observable behavior rather than only successful compilation.

## Reference answers

1. Return the parser's `Result<u16, ParseIntError>` directly without `expect`.
2. Match `RequestError` variants to safe static messages, keeping the internal diagnostic category separate.
3. `catch_unwind` does not catch `panic=abort`, guarantee a rollback, or automatically restore shared-state invariants. Treat plugin isolation as an explicit architecture decision and never expose panic payloads to API clients.

   ```rust
   fn parse_limit(raw: &str) -> Result<u16, std::num::ParseIntError> {
       raw.trim().parse::<u16>()
   }
   ```

   ```rust
   fn public_message(error: &RequestError) -> &'static str {
       match error {
           RequestError::InvalidLimit(_) => "limit must be an unsigned 16-bit integer",
           RequestError::Storage(_) => "request could not be completed",
       }
   }
   ```

## Sources

The Rust Book's error handling material underpins the distinction between normal errors and panics.

- [The Rust Programming Language: Error Handling](https://doc.rust-lang.org/book/ch09-00-error-handling.html)
