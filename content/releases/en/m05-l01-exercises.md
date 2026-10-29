# M05-L01 Exercises: Shared and exclusive borrowing

Self-assessment only: the website does not compile your solutions or award a score.

## Exercise 1: Predict

If a shared reference is still used afterward, can &mut String modify that same value now?

Identify the owner, references, and expected compiler or runtime outcome.

## Exercise 2: Repair

Compare explicit scope separation and moving the final read before the write; do not hide the original business output.

Demonstrate the unsafe or rejected boundary in a minimal reproducer, then repair it without deleting requirements.

## Exercise 3: Implement

Reproduce the conflict, then rearrange reads and writes in clear phases without duplicating the entire configuration.

**Acceptance evidence:** Show the borrow-check diagnostic and passing assertions for both preserved read and write behavior.

## Progressive hints

1. Write down whether each access uses &T, &mut T, owned T or a borrowed &str.
2. For conflicts, find the last time the original reference is used.
3. For UTF-8, distinguish bytes, Unicode scalar values and visible characters.

## Reference answers

- &T lends read access without changing the owner; multiple shared borrows may coexist.
- &mut T lends exclusive mutable access; overlapping incompatible uses of the same data are rejected.
- Order reads and writes deliberately so the last use of a shared reference precedes the mutable operation.

Use compiler output and actual tests to verify your own result.

## Sources

- [The Rust Book: References and Borrowing](https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html)
