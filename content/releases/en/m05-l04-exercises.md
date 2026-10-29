# M05-L04 Exercises: Mutable borrow conflicts and API design

Self-assessment only: the website does not compile your solutions or award a score.

## Exercise 1: Predict

Can an API safely accept both &mut Vec<String> and &String referring into that same Vec?

Identify the owner, references, and expected compiler or runtime outcome.

## Exercise 2: Repair

Reproduce E0502 for the original overlapping call; distinguish modifying one element from changing Vec length.

Demonstrate the unsafe or rejected boundary in a minimal reproducer, then repair it without deleting requirements.

## Exercise 3: Implement

Implement either read-before-push or copy-summary-before-push and test both.

**Acceptance evidence:** Show tests for the alternatives and why they avoid cloning the whole collection.

## Progressive hints

1. Write down whether each access uses &T, &mut T, owned T or a borrowed &str.
2. For conflicts, find the last time the original reference is used.
3. For UTF-8, distinguish bytes, Unicode scalar values and visible characters.

## Reference answers

- A shared element borrow and an exclusive borrow for structural Vec modification cannot overlap when both remain needed.
- Finish reading the old text before mutating, or extract a small Copy summary such as usize first.
- Prefer API signatures that require the narrowest access to elements or containers.

Use compiler output and actual tests to verify your own result.

## Sources

- [The Rust Book: References and Borrowing](https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html)
