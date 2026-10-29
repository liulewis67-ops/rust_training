# M01-L01 Exercises: Why Rust? Choosing with evidence

These are self-assessed local exercises. Record your prediction before opening the reference notes. No hosted grader or automatic score is available.

## Exercise 1: Predict

A Java service has occasional latency spikes. Is replacing the entire service with Rust guaranteed to remove them?

**Acceptance:** Give the expected result, the relevant Rust rule, and one reason an alternative answer would be wrong.

## Exercise 2: Diagnose or repair

Include a stop condition when the new version fails compatibility or cost targets.

**Acceptance:** Reproduce the error or counterexample when applicable. Describe the minimal correction, not a workaround that deletes a business requirement.

## Exercise 3: Implement and verify

Locate the bottleneck, propose a small Rust prototype, and compare the same inputs, functionality, deployment and maintenance constraints.

**Acceptance:** A one-page decision record with baseline, measurement method, rollback plan and explicit non-goals.

## Progressive hints

1. Identify the values, their Rust types and the owner or lifetime of each.
2. Separate what the compiler enforces from what needs a behavior test.
3. Check empty and boundary inputs before concluding the implementation is complete.

## Reference answers

- **Prediction:** Peak memory, latency, compatibility, delivery deadline and staff skills are measurable constraints. A language feature is not itself a performance result.
- **Diagnostic reasoning:** Rust can rule out many memory-safety and data-race patterns in safe code; Java and Go offer mature runtimes and ecosystems. None guarantees correct business logic or good latency without measurement.
- **Implementation approach:** Evaluate a small replaceable component on representative hardware and data. Record correctness, resource use, build/deploy costs, maintenance and when to stop.

Compare these principles with your actual outputs. A correct-looking narrative is not a substitute for a test or compiler diagnostic.

## Sources

- [The Rust Programming Language](https://doc.rust-lang.org/book/)
