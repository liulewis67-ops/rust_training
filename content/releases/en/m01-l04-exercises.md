# M01-L04 Exercises: Git, formatting, Clippy and minimal tests

These are self-assessed local exercises. Record your prediction before opening the reference notes. No hosted grader or automatic score is available.

## Exercise 1: Predict

Will git add . include unrelated work already in the tree?

**Acceptance:** Give the expected result, the relevant Rust rule, and one reason an alternative answer would be wrong.

## Exercise 2: Diagnose or repair

Intentionally return a constant discount once to prove your test catches an incorrect result.

**Acceptance:** Reproduce the error or counterexample when applicable. Describe the minimal correction, not a workaround that deletes a business requirement.

## Exercise 3: Implement and verify

Add a discount boundary assertion, run all four checks and stage only the relevant source and test files.

**Acceptance:** Show the red/green assertion result, staged diff and a one-sentence scope explanation.

## Exercise 4: Verified challenge — real assertions versus vacuous checks

Predict which assertions fail when `normalize_name` always returns `"rust"`. Run the three tests, inject the incorrect implementation, and restore the original. Provide the passing, failing, and restored outputs plus a statement of what each assertion proves.

From the repository root, run `node scripts/verify-lesson-drills.mjs` for all passing tests and expected compiler diagnostics.

## Progressive hints

1. Identify the values, their Rust types and the owner or lifetime of each.
2. Separate what the compiler enforces from what needs a behavior test.
3. Check empty and boundary inputs before concluding the implementation is complete.

## Reference answers

- **Prediction:** cargo fmt addresses style; cargo clippy highlights likely issues; cargo check verifies type and borrow constraints; cargo test checks declared behavior.
- **Diagnostic reasoning:** Use specific input and expected output. A test that only checks whether a function exists cannot catch an incorrect discount calculation.
- **Implementation approach:** Use git diff, git add <specific paths> and git diff --cached; leave unrelated files outside the PR.

Compare these principles with your actual outputs. A correct-looking narrative is not a substitute for a test or compiler diagnostic.

## Sources

- [The Rust Programming Language](https://doc.rust-lang.org/book/)
