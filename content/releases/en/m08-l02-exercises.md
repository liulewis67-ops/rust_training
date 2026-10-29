# M08-L02 Exercises: Closure captures and Fn, FnMut, FnOnce

These public exercises are for local, self-assessed Rust practice. They do not submit code to a hosted grader.

## Exercise 1: Predict

If a move closure owns a String but only calls len(), is it necessarily single-use?

Write down the expected item types or return values before running the code.

## Exercise 2: Diagnose

Pass a mutating closure where Fn is required and record the failure without using unnecessary clone.

Reproduce one incorrect behavior or compiler diagnostic and explain why the naive fix fails.

## Exercise 3: Implement

Implement read-only, counter-mutating and String-consuming callbacks using appropriate Fn-family bounds.

**Acceptance evidence:** Provide a capture/action/call-count table and successful and failing compiler evidence.

## Progressive hints

1. State which data is borrowed and which is owned.
2. Distinguish compilation, iteration/aggregation behavior and output ordering.
3. Exercise empty inputs, duplicates and Unicode where the contract requires them.

## Reference answers

- Closures capture their environment by borrowing or by value; move changes capture ownership, not automatically invocation count.
- Fn supports repeated shared calls; FnMut permits repeated calls that modify captured state; FnOnce allows consuming the closure and its captured values.
- Choose the least restrictive callback bound that still permits the implementation, and test capture-related borrow conflicts.

Only verified runs can establish that your implementation satisfies the requirements.

## Sources

- [The Rust Book: Common Collections](https://doc.rust-lang.org/book/ch08-00-common-collections.html)
- [The Rust Book: Iterators](https://doc.rust-lang.org/book/ch13-02-iterators.html)
