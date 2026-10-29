# M06-L04 Exercises: 'static bounds and misconceptions

Complete the exercises locally; these explanations are public self-review material, not a hosted grader.

## Exercise 1: Predict

If String satisfies T: 'static, is every borrow of that String an &'static str?

Write the expected borrow/owner relationship before compiling.

## Exercise 2: Diagnose

Show an owned String dropping at the end of a normal scope; do not turn runtime strings into leaked globals.

Reproduce the shortest failing case and identify why extending a lifetime annotation alone is not a fix.

## Exercise 3: Implement

Write one function that takes T: 'static by value and another that requires &'static str, then test calls separately.

**Acceptance evidence:** A valid/invalid call matrix and a real compiler diagnostic demonstrating the distinction.

## Exercise 4: Verified boundary challenge — The 'static type bound does not prevent Drop

Predict whether a literal reference, owned String, and local borrowed str satisfy `T: 'static`. Run two tests and reproduce E0597; use `DropSignal` to show the value can be dropped immediately. Replace an unnecessarily strict static-reference API with `&str`.

**Acceptance:** Execute `cargo +1.95.0 test --offline --manifest-path content/samples/verified-lesson-drills/Cargo.toml m06_static::`, record both the passing and failing evidence, and justify the repair without suppressing the diagnostic.

## Progressive hints

1. Identify which binding owns the buffer and which reference borrows it.
2. Decide whether the caller needs an independent owned result.
3. Check two scopes with different expiration points, not merely equal strings.

## Reference answers

- &'static str is a reference whose referent is valid for the required static lifetime.
- T: 'static means the type contains no shorter non-static references, not that its values cannot be dropped.
- An owned String can satisfy T: 'static while an arbitrary &String cannot be treated as &'static str.

Review these rules against your own compiler output, public tests and API design.

## Sources

- [Rust Book: Validating References with Lifetimes](https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html)
