# M06-L01 Exercises: Reference validity and lifetime relationships

Complete the exercises locally; these explanations are public self-review material, not a hosted grader.

## Exercise 1: Predict

Can changing the result to &'static str rescue a reference into a local String?

Write the expected borrow/owner relationship before compiling.

## Exercise 2: Diagnose

Do not use Box::leak to make a normal data-flow design appear valid.

Reproduce the shortest failing case and identify why extending a lifetime annotation alone is not a fix.

## Exercise 3: Implement

Reproduce the compiler error, then return an owned String or a slice of caller-owned input as appropriate.

**Acceptance evidence:** Record the original diagnostic and corrected owner flow, including an empty input.

## Progressive hints

1. Identify which binding owns the buffer and which reference borrows it.
2. Decide whether the caller needs an independent owned result.
3. Check two scopes with different expiration points, not merely equal strings.

## Reference answers

- Borrowed references are valid only while the referenced storage remains alive.
- Returning a view into a local owned value would create a dangling reference and is rejected.
- Choose an owned return or borrow data the caller already owns if that is the actual contract.

Review these rules against your own compiler output, public tests and API design.

## Sources

- [Rust Book: Validating References with Lifetimes](https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html)
