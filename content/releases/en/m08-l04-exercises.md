# M08-L04 Exercises: map, filter, fold, collect and laziness

These public exercises are for local, self-assessed Rust practice. They do not submit code to a hosted grader.

## Exercise 1: Predict

Will an unconsumed map closure increment a counter once for each input?

Write down the expected item types or return values before running the code.

## Exercise 2: Diagnose

Drop an unused map and show zero side effects; use for/for_each when the operation exists only for side effects.

Reproduce one incorrect behavior or compiler diagnostic and explain why the naive fix fails.

## Exercise 3: Implement

Combine filter, map and collect, then write a fold whose empty input result is explicit.

**Acceptance evidence:** Test empty, all-negative and mixed collections and compare closure call counts before/after consumption.

## Progressive hints

1. State which data is borrowed and which is owned.
2. Distinguish compilation, iteration/aggregation behavior and output ordering.
3. Exercise empty inputs, duplicates and Unicode where the contract requires them.

## Reference answers

- map transforms each item and filter selects items, but both are lazy adaptors.
- fold consumes an iterator and combines items from an explicit initial accumulator; the initial value defines empty-input behavior.
- collect builds a target collection and runs the iterator; for side effects alone prefer a for loop or for_each.

Only verified runs can establish that your implementation satisfies the requirements.

## Sources

- [The Rust Book: Common Collections](https://doc.rust-lang.org/book/ch08-00-common-collections.html)
- [The Rust Book: Iterators](https://doc.rust-lang.org/book/ch13-02-iterators.html)
