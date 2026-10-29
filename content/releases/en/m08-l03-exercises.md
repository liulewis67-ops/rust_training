# M08-L03 Exercises: iter, iter_mut and into_iter

These public exercises are for local, self-assessed Rust practice. They do not submit code to a hosted grader.

## Exercise 1: Predict

Which of for item in items and for item in &items consumes a Vec of non-Copy values?

Write down the expected item types or return values before running the code.

## Exercise 2: Diagnose

Read the old Vec after into_iter to reproduce E0382; keep a non-Clone item movable without allocating a duplicate.

Reproduce one incorrect behavior or compiler diagnostic and explain why the naive fix fails.

## Exercise 3: Implement

Implement a read, in-place update and owned transfer using iter, iter_mut and into_iter.

**Acceptance evidence:** Show each iterator Item type, output and whether the original collection remains usable.

## Exercise 4: Verified boundary challenge — Ownership evidence for all three iterator forms

Label the three iterator item types, run all tests, then reproduce E0382. Repair by borrowing for read-only work or extracting required information before consumption; explain when owned iteration remains the correct choice.

**Acceptance:** Execute `cargo +1.95.0 test --offline --manifest-path content/samples/verified-lesson-drills/Cargo.toml m08_iteration::`, provide expected and observed results and the intentional diagnostic, and explain how the repair preserves the API contract.

## Progressive hints

1. State which data is borrowed and which is owned.
2. Distinguish compilation, iteration/aggregation behavior and output ordering.
3. Exercise empty inputs, duplicates and Unicode where the contract requires them.

## Reference answers

- iter yields shared &T and preserves the collection's ownership.
- iter_mut yields exclusive &mut T for in-place changes without moving elements out.
- into_iter on an owned Vec consumes the collection and yields owned T; a previously owned binding cannot be used afterward.

Only verified runs can establish that your implementation satisfies the requirements.

## Sources

- [The Rust Book: Common Collections](https://doc.rust-lang.org/book/ch08-00-common-collections.html)
- [The Rust Book: Iterators](https://doc.rust-lang.org/book/ch13-02-iterators.html)
