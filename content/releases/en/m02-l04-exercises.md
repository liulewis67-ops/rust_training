# M02-L04 Exercises: Arrays, tuples, patterns and bounds

Work through these tasks in order. They are self-assessed: the site does not execute or grade your submissions.

## Exercise 1: Predict

Can a (timestamp, state, value) record be represented by a homogeneous array without losing types?

State your predicted outcome and the Rust rule that applies before running code.

## Exercise 2: Diagnose

Test first and last valid indexes, the first invalid index and a new classification case.

Reproduce at least one failure, identify whether it is a compiler rejection or a business assertion, and explain the smallest legitimate repair.

## Exercise 3: Implement

Use a three-element array for readings, a tuple for metadata and match for explicit value ranges.

**Acceptance evidence:** Supply an input/type/classification table and one safe bounds-check assertion.

## Exercise 4: Verified boundary challenge — Safe indexing and runtime array bounds

Predict indices `0`, `2`, `3`, run the three tests, then deliberately use `0..=values.len()` and locate the panic. Repair to `0..values.len()`; finally use `get` for a non-panicking lookup including empty slices and boundary indices.

**Acceptance:** Run `cargo +1.95.0 test --offline --manifest-path content/samples/verified-lesson-drills/Cargo.toml m02_shapes::`, record predictions and observed results, and explain the actual failure cause without deleting assertions or weakening the API.

## Progressive hints

1. Start from types, ownership and explicit input contracts rather than the surface syntax.
2. Use an actual cargo check for type issues and cargo test for behavioral outcomes.
3. Add an empty or boundary case and never delete failing checks to force success.

## Reference answers

- **Prediction:** An array [T; N] stores a fixed number of elements of one type and uses zero-based indexing.
- **Diagnosis:** Tuples can group heterogeneous fixed-position fields; destructuring assigns meaningful local names.
- **Approach:** match handles patterns and ranges; indexes must be in bounds, or use get for fallible access.

These are public explanations for self-review; compare them with your own compiler diagnostics and actual test output.

## Sources

- [The Rust Programming Language](https://doc.rust-lang.org/book/)
