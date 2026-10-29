# M05-L02 Exercises: Borrow ranges and non-lexical lifetimes

Self-assessment only: the website does not compile your solutions or award a score.

## Exercise 1: Predict

If a Vec element is last read before push, must its reference remain active until the end of the block?

Identify the owner, references, and expected compiler or runtime outcome.

## Exercise 2: Repair

Do not treat NLL as permission to ignore still-active aliases.

Demonstrate the unsafe or rejected boundary in a minimal reproducer, then repair it without deleting requirements.

## Exercise 3: Implement

Move only one println call after push, compare compilation with the earlier program and explain the difference.

**Acceptance evidence:** Save before/after diagnostics and identify the exact last read that keeps the shared borrow live.

## Progressive hints

1. Write down whether each access uses &T, &mut T, owned T or a borrowed &str.
2. For conflicts, find the last time the original reference is used.
3. For UTF-8, distinguish bytes, Unicode scalar values and visible characters.

## Reference answers

- Lexical variable scope and the span during which its reference is actively needed are distinct.
- The borrow checker tracks last relevant uses; a shared borrow may end before its binding's closing brace.
- Reordering a print and a push changes the program's required access overlap and therefore compilation.

Use compiler output and actual tests to verify your own result.

## Sources

- [The Rust Book: References and Borrowing](https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html)
