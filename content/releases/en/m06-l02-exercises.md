# M06-L02 Exercises: Function lifetime annotations and elision

Complete the exercises locally; these explanations are public self-review material, not a hosted grader.

## Exercise 1: Predict

Does fn choose(a: &str, b: &str) -> &str automatically use the longer-lived argument?

Write the expected borrow/owner relationship before compiling.

## Exercise 2: Diagnose

Try using the result after the source value is gone; record the rejection instead of simply changing the lifetime name.

Reproduce the shortest failing case and identify why extending a lifetime annotation alone is not a fix.

## Exercise 3: Implement

Write an explicit named-lifetime signature for the selection policy and test inputs with different scopes.

**Acceptance evidence:** Provide two valid calling patterns and one rejected escaping-borrow case.

## Exercise 4: Verified challenge — borrow provenance and E0106

Run the test where the query dies but the source text stays alive. Explain the returned borrow's provenance. Compile the two-input ambiguous signature for E0106; fix once for a left-only return and again for either source. Explain what lifetime names do not change.

From the repository root, run `node scripts/verify-lesson-drills.mjs` to check both the passing tests and expected compiler diagnostics.

## Progressive hints

1. Identify which binding owns the buffer and which reference borrows it.
2. Decide whether the caller needs an independent owned result.
3. Check two scopes with different expiration points, not merely equal strings.

## Reference answers

- Named lifetime parameters state a relationship among references, not a number of milliseconds or an object owner.
- Elision rules can determine a returned reference lifetime in simple signatures with one borrowed input.
- Multiple candidate input references often need an explicit relation; a longer annotation cannot revive a local owner.

Review these rules against your own compiler output, public tests and API design.

## Sources

- [Rust Book: Validating References with Lifetimes](https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html)
