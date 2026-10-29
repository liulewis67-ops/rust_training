# M07-L04 Exercises: From, TryFrom, newtype and invariants

These are local practice and self-assessment tasks, not hosted graded exercises.

## Exercise 1: Predict

Can an account ID be safely used as a byte count just because both are u64?

List the exact trait or domain constraint involved.

## Exercise 2: Repair

Test zero, upper bounds and invalid inputs; never silently default failed conversions.

Reproduce the failing type/behavior and select the smallest repair preserving the API's purpose.

## Exercise 3: Implement

Create distinct newtypes, with From where guaranteed and TryFrom for bounded or validated values.

**Acceptance evidence:** Show compile-time non-interchangeability and a typed error assertion for invalid values.

## Exercise 4: Verified boundary challenge — Validate before narrowing in TryFrom

Predict conversion of 0, 1, 65535 and 65536. Run two tests; deliberately narrow before validation to observe corruption. Compile the mixed-newtype failure and explain why domain-type mismatch and numeric range rejection are distinct errors.

**Acceptance:** Execute `cargo +1.95.0 test --offline --manifest-path content/samples/verified-lesson-drills/Cargo.toml m07_conversion::`, provide expected and observed results and the intentional diagnostic, and explain how the repair preserves the API contract.

## Progressive hints

1. Identify whether the caller needs one concrete type or many types at runtime.
2. Keep trait bounds limited to what the function body actually needs.
3. Verify semantic behavior separately from successful trait implementation.

## Reference answers

- A newtype wraps a primitive to give it a distinct domain identity and optional private-field invariants.
- Use From for infallible conversions that preserve meaning; use TryFrom when input validation may fail.
- Compose fallible conversions into a valid domain configuration rather than constructing invalid objects first.

Check the explanations against actual compiler output and behavior assertions.

## Sources

- [The Rust Book: Traits](https://doc.rust-lang.org/book/ch10-02-traits.html)
