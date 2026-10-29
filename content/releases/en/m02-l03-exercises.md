# M02-L03 Exercises: if, loop, while and for

Work through these tasks in order. They are self-assessed: the site does not execute or grade your submissions.

## Exercise 1: Predict

Do 0..n and 0..=n iterate the same values when n is 1?

State your predicted outcome and the Rust rule that applies before running code.

## Exercise 2: Diagnose

Test n=0, n=1 and a general case without confusing overflow with off-by-one errors.

Reproduce at least one failure, identify whether it is a compiler rejection or a business assertion, and explain the smallest legitimate repair.

## Exercise 3: Implement

Write for- and while-based totals with documented loop bounds and exit conditions.

**Acceptance evidence:** List iteration counts and totals; include an assertion that catches the wrong upper bound.

## Exercise 4: Verified transfer — Inclusive ranges, termination and branch types

Predict results for inclusive/exclusive ranges and zero/nonzero countdown. Run the tests, distinguish the intentional assertion at `sum_inclusive(1001)` from compile-time E0308, and repair the `if` example without changing its return contract. Add a passing test for `n=1000`.

**Acceptance:** Run `cargo +1.95.0 test --offline --manifest-path content/samples/verified-lesson-drills/Cargo.toml m02_control::` and the full verifier, and report predictions, observed results and the reason for your repair. Do not remove failing assertions to make a check green.

## Progressive hints

1. Start from types, ownership and explicit input contracts rather than the surface syntax.
2. Use an actual cargo check for type issues and cargo test for behavioral outcomes.
3. Add an empty or boundary case and never delete failing checks to force success.

## Reference answers

- **Prediction:** if can select a value if all branches produce compatible types.
- **Diagnosis:** loop repeats until break; while has a condition; for traverses a range or iterator.
- **Approach:** Choose 0..n versus 0..=n intentionally, establish termination and consider arithmetic overflow.

These are public explanations for self-review; compare them with your own compiler diagnostics and actual test output.

## Sources

- [The Rust Programming Language](https://doc.rust-lang.org/book/)
