# M02-L02 Exercises: Expressions, statements, functions and return values

Work through these tasks in order. They are self-assessed: the site does not execute or grade your submissions.

## Exercise 1: Predict

Does a trailing semicolon after a u32 calculation return u32?

State your predicted outcome and the Rust rule that applies before running code.

## Exercise 2: Diagnose

Make one if arm produce () and show why another correct arm does not rescue the type.

Reproduce at least one failure, identify whether it is a compiler rejection or a business assertion, and explain the smallest legitimate repair.

## Exercise 3: Implement

Reproduce the mismatched-return diagnostic, then repair the function using both a tail expression and return.

**Acceptance evidence:** Keep red/green cargo check output and a functional order-total assertion.

## Exercise 4: Verified challenge — tail expressions and E0308

Predict the passing case, a trailing semicolon, and an `if` arm that yields unit. Run the `m02::` tests, compile the counterexample, and repair a copy using both a tail expression and explicit `return`. Explain each resulting type.

From the repository root, run `node scripts/verify-lesson-drills.mjs` for all passing tests and expected compiler diagnostics.

## Progressive hints

1. Start from types, ownership and explicit input contracts rather than the surface syntax.
2. Use an actual cargo check for type issues and cargo test for behavioral outcomes.
3. Add an empty or boundary case and never delete failing checks to force success.

## Reference answers

- **Prediction:** Function signatures define inputs and outputs; the body must satisfy the declared return type.
- **Diagnosis:** An expression evaluates to a value; adding a trailing semicolon turns its result into a statement whose value is ().
- **Approach:** A tail expression and explicit return may produce the same value, but every if branch must agree on its type.

These are public explanations for self-review; compare them with your own compiler diagnostics and actual test output.

## Sources

- [The Rust Programming Language](https://doc.rust-lang.org/book/)
