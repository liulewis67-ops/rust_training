# M03-L03 Exercises: Option and missing values

These are local self-assessment tasks. Predict first, test second, compare with the public reference notes last.

## Exercise 1: Predict

Can a lookup that returns "" for both empty names and missing IDs distinguish those inputs?

Explain the relevant Rust type or ownership rule.

## Exercise 2: Diagnose

Handle None without unconditional unwrap and keep returned text borrowed from the stored ticket.

Reproduce the failure or boundary condition and explain a minimal fix without changing the original requirement.

## Exercise 3: Implement

Return Option<&str> and test a normal name, an existing empty name and a missing ID.

**Acceptance:** Three result assertions and an explicit caller-side branch for absence.

## Progressive hints

1. Identify the distinct states, values and module boundaries.
2. Check compiler constraints and behavior assertions separately.
3. Test a missing or invalid value before claiming the function is complete.

## Reference answers

- Option<T> has Some(value) and None and makes absence part of the return type.
- match or if let requires the caller to choose how to handle a missing value.
- unwrap is inappropriate when a normal input can produce None; prefer explicit handling or propagation.

The answer explains the principles; use actual tests to establish that your own implementation satisfies the contract.

## Sources

- [The Rust Programming Language](https://doc.rust-lang.org/book/)
