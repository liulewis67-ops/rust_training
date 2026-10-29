# M05-L03 Exercises: String, str, slices and UTF-8

Self-assessment only: the website does not compile your solutions or award a score.

## Exercise 1: Predict

Must len() and chars().count() agree for 你好?

Identify the owner, references, and expected compiler or runtime outcome.

## Exercise 2: Repair

Attempt to slice inside a multibyte UTF-8 character; avoid converting everything to owned String.

Demonstrate the unsafe or rejected boundary in a minimal reproducer, then repair it without deleting requirements.

## Exercise 3: Implement

Extend first_token(&str) checks for ASCII, Chinese, U+3000, leading/trailing whitespace and empty input.

**Acceptance evidence:** Supply exact token and byte-length assertions with an explanation of valid boundaries.

## Exercise 4: Verified boundary challenge — UTF-8 byte boundaries and runtime panic

Predict first tokens with ASCII and U+3000 separators, run three tests, compare `get(..3)` with `get(..1)` and then deliberately slice directly at byte 1. Explain safe `None` versus panic and why byte offsets are not character positions.

**Acceptance:** Execute `cargo +1.95.0 test --offline --manifest-path content/samples/verified-lesson-drills/Cargo.toml m05_utf8::`, record both the passing and failing evidence, and justify the repair without suppressing the diagnostic.

## Progressive hints

1. Write down whether each access uses &T, &mut T, owned T or a borrowed &str.
2. For conflicts, find the last time the original reference is used.
3. For UTF-8, distinguish bytes, Unicode scalar values and visible characters.

## Reference answers

- String owns UTF-8 text; &str borrows a view of text with a lifetime tied to valid source storage.
- str::len counts UTF-8 bytes, not Unicode characters; slicing requires valid character byte boundaries.
- split_whitespace handles Unicode whitespace and can return a borrowed first token, with a defined empty-input result.

Use compiler output and actual tests to verify your own result.

## Sources

- [The Rust Book: References and Borrowing](https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html)
