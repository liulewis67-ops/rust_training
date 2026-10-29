# M03-L02 Exercises: Enums and match

These are local self-assessment tasks. Predict first, test second, compare with the public reference notes last.

## Exercise 1: Predict

Will a wildcard branch always provide the correct business response to a new Cancelled variant?

Explain the relevant Rust type or ownership rule.

## Exercise 2: Diagnose

Include a data-bearing variant and verify its payload is not silently discarded.

Reproduce the failure or boundary condition and explain a minimal fix without changing the original requirement.

## Exercise 3: Implement

Extend the task enum and update all state-display and action matches explicitly.

**Acceptance:** Capture the initial non-exhaustive match diagnostic and passing assertions for all states.

## Progressive hints

1. Identify the distinct states, values and module boundaries.
2. Check compiler constraints and behavior assertions separately.
3. Test a missing or invalid value before claiming the function is complete.

## Reference answers

- An enum represents one of a closed set of distinct variants, some carrying associated data.
- match destructures variants and can bind variant data, with exhaustiveness checked by the compiler.
- Adding a new state should trigger a deliberate review of every behavior that depends on the state.

The answer explains the principles; use actual tests to establish that your own implementation satisfies the contract.

## Sources

- [The Rust Programming Language](https://doc.rust-lang.org/book/)
