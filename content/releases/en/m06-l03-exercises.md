# M06-L03 Exercises: Borrowed structs versus owned return values

Complete the exercises locally; these explanations are public self-review material, not a hosted grader.

## Exercise 1: Predict

Can a view borrowing request text be stored after that request text is dropped?

Write the expected borrow/owner relationship before compiling.

## Exercise 2: Diagnose

Try keeping the borrowed view after input cleanup; do not weaken the contract using unspecified global storage.

Reproduce the shortest failing case and identify why extending a lifetime annotation alone is not a fix.

## Exercise 3: Implement

Implement an immediate borrowed configuration view and a separate owned queue-ready result.

**Acceptance evidence:** Show both API signatures and why only the queue result requires owned fields.

## Exercise 4: Verified transfer — Short-lived views versus independently owned results

Predict whether a borrowed view and an owned alert survive the input scope. Run three tests, reproduce E0515, and design distinct queue-ready and immediate-view APIs. Test `"R20|text"`, `"|"`, and a missing separator without inventing static lifetime annotations.

**Acceptance:** Record the result of `cargo +1.95.0 test --offline --manifest-path content/samples/verified-lesson-drills/Cargo.toml m06_views::`, the deliberate compile-fail diagnostic, and your independent fix. Do not hide errors by cloning everything or deleting assertions.

## Progressive hints

1. Identify which binding owns the buffer and which reference borrows it.
2. Decide whether the caller needs an independent owned result.
3. Check two scopes with different expiration points, not merely equal strings.

## Reference answers

- A struct holding &str fields needs a lifetime parameter tied to its source data.
- A borrowed view avoids copying text but cannot outlive the input owner.
- An owned String-based result can survive independently, at a documented allocation cost.

Review these rules against your own compiler output, public tests and API design.

## Sources

- [Rust Book: Validating References with Lifetimes](https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html)
