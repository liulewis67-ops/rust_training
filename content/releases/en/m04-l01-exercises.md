# M04-L01 Exercises: Owner, scope and Drop

Complete each exercise locally and review the public explanations only afterward.

## Exercise 1: Predict

In a nested scope, when do three named resources run their Drop handlers?

Explain the ownership state and which bindings remain valid.

## Exercise 2: Diagnose

Move one resource to another owner and ensure the old binding is not counted as another drop.

Reproduce the compiler diagnostic where relevant. Do not remove a required output or add a blanket clone merely to pass compilation.

## Exercise 3: Implement

Predict event order by hand and add a third resource to the example before running it.

**Acceptance:** Provide scope diagrams and actual output, distinguishing bindings from resource lifetimes.

## Progressive hints

1. Trace bindings and owned values separately.
2. Ask whether the operation reads, borrows, moves or duplicates the data.
3. Use both a compiler check and a behavioral assertion.

## Reference answers

- Rust values have owners; a binding and its owned data are distinct concepts.
- When a scope ends, owned values are dropped in the language-defined order. Custom Drop runs before its fields are cleaned up.
- Draw an owner/value/resource graph rather than assuming a physical heap address represents ownership.

These explain the rules but do not replace testing your own implementation.

## Sources

- [The Rust Book: Understanding Ownership](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html)
