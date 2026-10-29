# M07-L01 Exercises: Generics and trait bounds

These are local practice and self-assessment tasks, not hosted graded exercises.

## Exercise 1: Predict

Does a function declared with <T> automatically support the > operator on T?

List the exact trait or domain constraint involved.

## Exercise 2: Repair

Pass a type lacking the required comparison trait and save the compiler error; avoid unrelated Clone bounds.

Reproduce the failing type/behavior and select the smallest repair preserving the API's purpose.

## Exercise 3: Implement

Extract a shared selection function, add its real comparison bound and test two concrete types.

**Acceptance evidence:** Demonstrate valid results for two types and explain the compile-time contract.

## Progressive hints

1. Identify whether the caller needs one concrete type or many types at runtime.
2. Keep trait bounds limited to what the function body actually needs.
3. Verify semantic behavior separately from successful trait implementation.

## Reference answers

- A generic parameter separates reusable algorithm structure from concrete input types.
- Trait bounds declare the minimum operations a generic function is allowed to call.
- Prefer constraints derived from actual function requirements; a bound such as Clone should not be added without a cloning operation.

Check the explanations against actual compiler output and behavior assertions.

## Sources

- [The Rust Book: Traits](https://doc.rust-lang.org/book/ch10-02-traits.html)
