# M01-L02 Exercises: rustup, Cargo, editions and project layout

These are self-assessed local exercises. Record your prediction before opening the reference notes. No hosted grader or automatic score is available.

## Exercise 1: Predict

Does edition = "2024" prove that this machine is using rustc 1.95.0?

**Acceptance:** Give the expected result, the relevant Rust rule, and one reason an alternative answer would be wrong.

## Exercise 2: Diagnose or repair

Contrast a missing toolchain, a wrong working directory and stale dependency resolution.

**Acceptance:** Reproduce the error or counterexample when applicable. Describe the minimal correction, not a workaround that deletes a business requirement.

## Exercise 3: Implement and verify

In a clean folder record rustc --version, cargo --version, rustup show active-toolchain and the Cargo manifest before running cargo check.

**Acceptance:** Actual command outputs and a reproducible cargo check result, not a claim that the environment is correct.

## Exercise 4: Verified transfer — Toolchain, Edition and Cargo metadata have different roles

Run `rustc +1.95.0 --version` and Cargo metadata for this sample package. Identify the toolchain, package version, and Edition separately; change the package version in a private copy and predict what metadata changes. Document a reproducible environment without deleting the lockfile to hide a problem.

**Acceptance:** Run `cargo +1.95.0 test --offline --manifest-path content/samples/verified-lesson-drills/Cargo.toml m01_toolchain::` and the full verifier, and report predictions, observed results and the reason for your repair. Do not remove failing assertions to make a check green.

## Progressive hints

1. Identify the values, their Rust types and the owner or lifetime of each.
2. Separate what the compiler enforces from what needs a behavior test.
3. Check empty and boundary inputs before concluding the implementation is complete.

## Reference answers

- **Prediction:** rustup installs and selects toolchains; rustc compiles Rust; Cargo manages packages, dependencies, builds and tests.
- **Diagnostic reasoning:** An edition controls source language compatibility, not a particular rustc binary. A toolchain selector, rust-toolchain.toml or explicit +version selects the compiler.
- **Implementation approach:** Cargo.toml declares package and dependencies, src/main.rs is a binary entry, src/lib.rs is a library entry, and Cargo.lock records resolved dependencies.

Compare these principles with your actual outputs. A correct-looking narrative is not a substitute for a test or compiler diagnostic.

## Sources

- [The Rust Programming Language](https://doc.rust-lang.org/book/)
