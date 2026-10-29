# M07-L02 Exercises: Traits, impl and associated types

These are local practice and self-assessment tasks, not hosted graded exercises.

## Exercise 1: Predict

If two types define summary() as inherent methods, do they implement a trait named Summary?

List the exact trait or domain constraint involved.

## Exercise 2: Repair

Remove a required method or mismatch its associated type to observe a compile-time implementation error.

Reproduce the failing type/behavior and select the smallest repair preserving the API's purpose.

## Exercise 3: Implement

Implement a shared trait on two business models and call it from a generic function.

**Acceptance evidence:** List concrete implementations and output assertions, plus the initial diagnostic.

## Progressive hints

1. Identify whether the caller needs one concrete type or many types at runtime.
2. Keep trait bounds limited to what the function body actually needs.
3. Verify semantic behavior separately from successful trait implementation.

## Reference answers

- A trait defines shared method requirements; impl Trait for Type supplies that contract for each concrete type.
- Inherent impl Type methods are distinct from trait implementations even when names match.
- Associated types describe implementation-specific related types; choose them deliberately instead of duplicating generic parameters.

Check the explanations against actual compiler output and behavior assertions.

## Sources

- [The Rust Book: Traits](https://doc.rust-lang.org/book/ch10-02-traits.html)
