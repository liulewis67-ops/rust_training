# M03-L01 Exercises: Structs, fields and methods

These are local self-assessment tasks. Predict first, test second, compare with the public reference notes last.

## Exercise 1: Predict

If width and height must never both be zero, is it safe to expose both as freely writable fields?

Explain the relevant Rust type or ownership rule.

## Exercise 2: Diagnose

Test a valid initial state, a rejected update and preservation of the previous state.

Reproduce the failure or boundary condition and explain a minimal fix without changing the original requirement.

## Exercise 3: Implement

Separate validated construction, read-only queries and a controlled &mut self update method.

**Acceptance:** Public API assertions plus proof that private internal fields cannot be accessed from a sibling module.

## Progressive hints

1. Identify the distinct states, values and module boundaries.
2. Check compiler constraints and behavior assertions separately.
3. Test a missing or invalid value before claiming the function is complete.

## Reference answers

- A struct groups related typed fields, and construction must satisfy each field type.
- impl defines methods beside a type; &self reads while &mut self allows mutation without transferring ownership.
- Use private fields and validated methods when updates must preserve a business invariant.

The answer explains the principles; use actual tests to establish that your own implementation satisfies the contract.

## Sources

- [The Rust Programming Language](https://doc.rust-lang.org/book/)
