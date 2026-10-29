# M04-L04 Exercises: Parameters, returns and partial moves

Complete each exercise locally and review the public explanations only afterward.

## Exercise 1: Predict

After moving the String body, can a Copy status still be read? Can the entire original ticket be passed again?

Explain the ownership state and which bindings remain valid.

## Exercise 2: Diagnose

Try to reuse the partially moved whole struct and examine the diagnostic; note extra constraints for types implementing Drop.

Reproduce the compiler diagnostic where relevant. Do not remove a required output or add a blanket clone merely to pass compilation.

## Exercise 3: Implement

Extract body text, inspect untouched fields and construct a new complete ticket.

**Acceptance:** Compile and test the reconstructed fields without cloning the entire ticket.

## Progressive hints

1. Trace bindings and owned values separately.
2. Ask whether the operation reads, borrows, moves or duplicates the data.
3. Use both a compiler check and a behavioral assertion.

## Reference answers

- By-value parameters transfer ownership of their non-Copy inputs into the function.
- Moving a non-Copy field can partially move a struct; untouched Copy fields may remain readable, but the whole value may no longer be usable.
- Reconstruct an owned result by deliberately supplying the moved fields and any remaining data.

These explain the rules but do not replace testing your own implementation.

## Sources

- [The Rust Book: Understanding Ownership](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html)
