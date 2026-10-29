# M02-L01 Exercises: Variables, mutability, primitive types and inference

Work through these tasks in order. They are self-assessed: the site does not execute or grade your submissions.

## Exercise 1: Predict

Can u8 and u32 be added directly without conversion?

State your predicted outcome and the Rust rule that applies before running code.

## Exercise 2: Diagnose

Test zero and u8::MAX and inspect the compiler error after removing the conversion.

Reproduce at least one failure, identify whether it is a compiler rejection or a business assertion, and explain the smallest legitimate repair.

## Exercise 3: Implement

Build a counter with a mutable total and an explicit, lossless conversion of the incoming u8 value.

**Acceptance evidence:** Record the inferred types, rejected expression and passing assertions.

## Progressive hints

1. Start from types, ownership and explicit input contracts rather than the surface syntax.
2. Use an actual cargo check for type issues and cargo test for behavioral outcomes.
3. Add an empty or boundary case and never delete failing checks to force success.

## Reference answers

- **Prediction:** Bindings are immutable by default; mut permits reassignment but does not alter the type.
- **Diagnosis:** Type inference follows expressions and constraints; annotate types when a value or operation is ambiguous.
- **Approach:** Different integer types do not implicitly widen into one another. Convert deliberately after checking the intended range.

These are public explanations for self-review; compare them with your own compiler diagnostics and actual test output.

## Sources

- [The Rust Programming Language](https://doc.rust-lang.org/book/)
