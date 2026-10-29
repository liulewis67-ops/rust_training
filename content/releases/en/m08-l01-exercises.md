# M08-L01 Exercises: Vec, HashMap and access strategies

These public exercises are for local, self-assessed Rust practice. They do not submit code to a hosted grader.

## Exercise 1: Predict

Can HashMap iteration guarantee stable creation order across repeated runs?

Write down the expected item types or return values before running the code.

## Exercise 2: Diagnose

Include empty input, duplicate IDs and Unicode keys; do not use arbitrary map iteration for UI ordering.

Reproduce one incorrect behavior or compiler diagnostic and explain why the naive fix fails.

## Exercise 3: Implement

Build an ordered Vec and keyed HashMap, then verify insertion, replacement, missing key and output order.

**Acceptance evidence:** Test stable output ordering and explain the costs and benefits of each structure.

## Progressive hints

1. State which data is borrowed and which is owned.
2. Distinguish compilation, iteration/aggregation behavior and output ordering.
3. Exercise empty inputs, duplicates and Unicode where the contract requires them.

## Reference answers

- Vec stores an ordered sequence and supports positional access; get returns Option instead of panicking on an invalid index.
- HashMap maps unique keys to values, and a repeated insert replaces the previous value; entry supports aggregation without silently overwriting.
- Choose data structures from access requirements and explicitly sort or maintain a sequence when deterministic output matters.

Only verified runs can establish that your implementation satisfies the requirements.

## Sources

- [The Rust Book: Common Collections](https://doc.rust-lang.org/book/ch08-00-common-collections.html)
- [The Rust Book: Iterators](https://doc.rust-lang.org/book/ch13-02-iterators.html)
