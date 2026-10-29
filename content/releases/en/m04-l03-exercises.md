# M04-L03 Exercises: Copy, Clone and cost

Complete each exercise locally and review the public explanations only afterward.

## Exercise 1: Predict

Are assigning a u32 and calling String::clone both guaranteed to allocate heap storage?

Explain the ownership state and which bindings remain valid.

## Exercise 2: Diagnose

Test empty and large strings but do not mistake one example for a benchmark.

Reproduce the compiler diagnostic where relevant. Do not remove a required output or add a blanket clone merely to pass compilation.

## Exercise 3: Implement

Mark exactly where two independent owned strings are required, and replace unnecessary duplication with borrowing.

**Acceptance:** Report binding usability after Copy/Clone/move and which costs still require measurement.

## Exercise 4: Verified challenge — Copy and Clone are different ownership contracts

Draw ownership for `u32` copies, String moves, and String clones. Run the passing tests and locate E0382 in the compile-fail file. Repair a copy via clone and via borrowing; explain when independent ownership is genuinely required.

From the repository root, run `node scripts/verify-lesson-drills.mjs` to check both the passing tests and expected compiler diagnostics.

## Progressive hints

1. Trace bindings and owned values separately.
2. Ask whether the operation reads, borrows, moves or duplicates the data.
3. Use both a compiler check and a behavioral assertion.

## Reference answers

- Copy enables implicit duplication of suitable values such as u32, without invalidating the original binding.
- Clone is an explicit request for a type-specific duplicate; cloning an owned String generally allocates its own buffer.
- Move expresses ownership transfer, not a promise that bytes physically relocate.

These explain the rules but do not replace testing your own implementation.

## Sources

- [The Rust Book: Understanding Ownership](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html)
