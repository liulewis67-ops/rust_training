# M09-L01 Exercises: Result and error propagation

> **Exercise path:** Predict → diagnose → implement. Make an explicit prediction about the compiler, result value, and error source before running local Rust 1.95.0 / Edition 2024 checks.

## Learning goals and order

Complete these three tasks without erasing a parse error. `?` short-circuits **the containing function**, and the calling function can still examine its `Result`. Record real output or compiler diagnostics for each step.

## 1. Predict: where is the failure observed?

In the original code, `triple("4")` returns `Ok(12)` and `triple("four")` returns `Err(ParseIntError)`. Trace the `?` operator: does it panic, substitute a default, or return from `triple`? Can `main` still observe the failure?

**Hint:** Follow the return type of the function that contains `?`, then look at how its caller prints or matches the result.

**Acceptance:** Predict both outcomes correctly; no panic or silent fallback is introduced, and the caller can inspect the error.

~~~rust
use std::num::ParseIntError;

/// Parses one unsigned value and triples it.
fn triple(input: &str) -> Result<u32, ParseIntError> {
    let value = input.parse::<u32>()?;
    Ok(value * 3)
}

/// Checks and prints the caller-visible result variants.
fn main() {
    println!("{:?}", triple("4"));
    println!("{:?}", triple("four"));
}
~~~

## 2. Repair: incompatible return type

The original function attempts to use `?` on a `Result` while declaring an `Option` return. Repair the signature and body so valid input yields `Ok(Some(value))` and invalid numeric text still yields the original `ParseIntError`.

**Hint:** The appropriate return type is `Result<Option<u32>, ParseIntError>`. Parse the input with `?`, then wrap the successful result in `Some` and `Ok`; do not call `.ok()`.

**Acceptance:** Before the fix the program fails to compile for incompatible error propagation. After the fix `"8"` returns `Ok(Some(8))`, and malformed input remains `Err(ParseIntError)`.

~~~rust
/// Attempts to parse optional text but uses an incompatible error channel.
fn parse_optional(input: &str) -> Option<u32> {
    let value = input.parse::<u32>()?;
    Some(value)
}

/// Checks both parse outcomes.
fn main() {
    assert_eq!(parse_optional("8"), Some(8));
    assert!(parse_optional("eight").is_none());
}
~~~

## 3. Implement: propagate a scaling parse error

Implement `scale_by_factor`: trim and parse a `u32`, multiply it by a supplied factor, and return `Result`. The exercise inputs are chosen so multiplication does not overflow.

**Hint:** Use `input.trim().parse::<u32>()?`, then `Ok(value * factor)`.

**Acceptance:** Surrounding whitespace is accepted, valid numbers yield the correct product, and malformed input returns `Err` without panic or a fabricated zero. The caller can continue after receiving the failure.

~~~rust
use std::num::ParseIntError;

/// Parses an unsigned value and scales it by the caller's factor.
fn scale_by_factor(_input: &str, _factor: u32) -> Result<u32, ParseIntError> {
    // TODO: Parse with ?, then return the scaled value in Ok.
    todo!()
}

/// Checks success, propagation, and continued caller control.
fn main() {
    assert_eq!(scale_by_factor(" 6 ", 4), Ok(24));
    assert!(matches!(scale_by_factor("six", 4), Err(_)));
    assert_eq!(scale_by_factor("2", 4), Ok(8));
}
~~~

## Self-check list

- [ ] I can identify the function exited by `?` on `Err`.
- [ ] Invalid or out-of-range numeric text remains a returned error.
- [ ] Any required error conversion comes from `From` or an explicit `map_err` rather than discarding the cause.

Use real tests and diagnostics, not only a zero process exit code.

## Reference answers

1. `triple("4")` is `Ok(12)`; `triple("four")` is `Err(ParseIntError)`. `triple` returns early, but `main` receives a result to examine.
2. The corrected optional parse uses `Result<Option<u32>, ParseIntError>` and `Ok(Some(value))` when parsing succeeds.
3. The scaling function returns `Ok(value * factor)` on success and preserves the original parser error on failure.

**Boundary note:** Real production code must also consider multiplication overflow, for example by adding `checked_mul` and a broader error type. This exercise assumes the multiplication is representable.

   ```rust
   fn parse_optional(
       input: &str,
   ) -> Result<Option<u32>, std::num::ParseIntError> {
       let value = input.parse::<u32>()?;
       Ok(Some(value))
   }
   ```

   ```rust
   fn scale_by_factor(
       input: &str,
       factor: u32,
   ) -> Result<u32, std::num::ParseIntError> {
       let value = input.trim().parse::<u32>()?;
       Ok(value * factor)
   }
   ```

## Sources

The Rust Book chapter linked below documents `Result`, `?`, and ordinary recoverable failures.

- [The Rust Programming Language: Error Handling](https://doc.rust-lang.org/book/ch09-00-error-handling.html)
