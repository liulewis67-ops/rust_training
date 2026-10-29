# M03-L04 Exercises: Modules, visibility and public APIs

These are local self-assessment tasks. Predict first, test second, compare with the public reference notes last.

## Exercise 1: Predict

If a caller needs mark_as_read, must it also mutate status and attempts directly?

Explain the relevant Rust type or ownership rule.

## Exercise 2: Diagnose

Reproduce a denied direct field access from another module instead of making everything pub.

Reproduce the failure or boundary condition and explain a minimal fix without changing the original requirement.

## Exercise 3: Implement

Keep state fields private and export a minimal read/update API with its invariants.

**Acceptance:** Show valid external behavior and the intentional visibility diagnostic.

## Progressive hints

1. Identify the distinct states, values and module boundaries.
2. Check compiler constraints and behavior assertions separately.
3. Test a missing or invalid value before claiming the function is complete.

## Reference answers

- Modules organize namespaces and paths; declarations are private unless visibility is explicitly granted.
- pub on an item does not automatically open every enclosing module or every private field.
- Expose a narrow stable operation instead of making internal representation part of the public contract.

The answer explains the principles; use actual tests to establish that your own implementation satisfies the contract.

## Sources

- [The Rust Programming Language](https://doc.rust-lang.org/book/)
