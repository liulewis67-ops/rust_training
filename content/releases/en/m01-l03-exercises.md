# M01-L03 Exercises: build, check, run, test and diagnostic reading

These are self-assessed local exercises. Record your prediction before opening the reference notes. No hosted grader or automatic score is available.

## Exercise 1: Predict

Can a unit test be meaningfully evaluated if its crate fails compilation?

**Acceptance:** Give the expected result, the relevant Rust rule, and one reason an alternative answer would be wrong.

## Exercise 2: Diagnose or repair

Produce a case that compiles but fails a business assertion; contrast it with a real compile error.

**Acceptance:** Reproduce the error or counterexample when applicable. Describe the minimal correction, not a workaround that deletes a business requirement.

## Exercise 3: Implement and verify

Run cargo check, cargo test and cargo run separately, capturing the first relevant diagnostic and exit status.

**Acceptance:** A short reproduction log with each stage, before/after evidence and the exact fix applied.

## Progressive hints

1. Identify the values, their Rust types and the owner or lifetime of each.
2. Separate what the compiler enforces from what needs a behavior test.
3. Check empty and boundary inputs before concluding the implementation is complete.

## Reference answers

- **Prediction:** cargo check type-checks quickly without producing a normal executable; build produces artifacts; run executes a binary; test builds and runs tests.
- **Diagnostic reasoning:** Record the exact command, toolchain, first relevant error, expected behavior and observed result before changing implementation.
- **Implementation approach:** Fix compilation before interpreting unit-test failures. A successful check does not assert correct discount calculations or runtime output.

Compare these principles with your actual outputs. A correct-looking narrative is not a substitute for a test or compiler diagnostic.

## Sources

- [The Rust Programming Language](https://doc.rust-lang.org/book/)
