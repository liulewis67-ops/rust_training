# M04-L02 Exercises: Where a move occurs

Complete each exercise locally and review the public explanations only afterward.

## Exercise 1: Predict

Can a caller still use message after render(message: String) consumes it?

Explain the ownership state and which bindings remain valid.

## Exercise 2: Diagnose

Demonstrate one E0382 failure instead of adding clone everywhere.

Reproduce the compiler diagnostic where relevant. Do not remove a required output or add a blanket clone merely to pass compilation.

## Exercise 3: Implement

Draw the owner arrows at each parameter and return boundary, then implement a borrowing alternative when a copy is unnecessary.

**Acceptance:** Record the move point, corrected program output and justification for ownership versus borrowing.

## Progressive hints

1. Trace bindings and owned values separately.
2. Ask whether the operation reads, borrows, moves or duplicates the data.
3. Use both a compiler check and a behavioral assertion.

## Reference answers

- Assigning a non-Copy value can move ownership from one binding to another.
- Passing String to a by-value parameter moves it into the callee; returning it transfers ownership again.
- E0382 points to a moved value later used through its invalidated old binding.

These explain the rules but do not replace testing your own implementation.

## Sources

- [The Rust Book: Understanding Ownership](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html)
