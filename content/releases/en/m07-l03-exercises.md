# M07-L03 Exercises: Static dispatch, dyn and object safety

These are local practice and self-assessment tasks, not hosted graded exercises.

## Exercise 1: Predict

Can Vec<T> contain two distinct concrete strategies when T is one fixed type?

List the exact trait or domain constraint involved.

## Exercise 2: Repair

Add a generic method to the trait and inspect why it prevents dyn use; redesign only the necessary boundary.

Reproduce the failing type/behavior and select the smallest repair preserving the API's purpose.

## Exercise 3: Implement

Implement one generic strategy processor and one Vec<Box<dyn Trait>> processor.

**Acceptance evidence:** Test two formatter outputs and document the static/dynamic choice and error.

## Progressive hints

1. Identify whether the caller needs one concrete type or many types at runtime.
2. Keep trait bounds limited to what the function body actually needs.
3. Verify semantic behavior separately from successful trait implementation.

## Reference answers

- Generics commonly enable static dispatch specialized to concrete types.
- A dyn Trait object enables calls through a shared compatible trait interface when heterogeneous implementations must coexist.
- A trait's dyn compatibility rules restrict methods such as unbounded generic methods on trait objects.

Check the explanations against actual compiler output and behavior assertions.

## Sources

- [The Rust Book: Traits](https://doc.rust-lang.org/book/ch10-02-traits.html)
