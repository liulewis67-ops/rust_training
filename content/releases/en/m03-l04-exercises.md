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

## Exercise 4: Verified transfer — Module boundaries and private fields

Predict the visibility outcome of reading `task.state` versus calling `task.is_closed()`. Run the tests and the E0616 fixture. Repair external state mutation by calling `close()` rather than making fields public, then add a test for the initial state and explain the boundary's guarantees.

**Acceptance:** Run `cargo +1.95.0 test --offline --manifest-path content/samples/verified-lesson-drills/Cargo.toml m03_visibility::` and the full verifier, and report predictions, observed results and the reason for your repair. Do not remove failing assertions to make a check green.

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
