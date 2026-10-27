# Local exercise: Return the first word

Use Rust 1.95.0 and Edition 2024. Copy the runnable example from this page into `src/main.rs` in a new Cargo project, then run these commands from the project root:

```sh
rustup toolchain install 1.95.0
cargo +1.95.0 new borrowed-text --edition 2024
cd borrowed-text
cargo +1.95.0 test
```

Add tests for an empty string, text without spaces, and multiple words to `first_word`. The returned `&str` borrows from the input; do not return a slice into a `String` local to the function.

`borrow-conflict-compile-fail.rs` is a separate example that is expected to fail compilation. Do not add it as a normal target in the same Cargo project. The expected E0502 diagnostic says that you cannot create a mutable borrow while a shared borrow is still in use.

## Reference implementation

Add this test module after `first_word` in `src/main.rs`, then run `cargo +1.95.0 test`. All three tests should pass:

```rust
#[cfg(test)]
mod tests {
    use super::first_word;

    #[test]
    fn empty_text_has_no_word() {
        assert_eq!(first_word(""), "");
    }

    #[test]
    fn one_word_is_returned_unchanged() {
        assert_eq!(first_word("Rust"), "Rust");
    }

    #[test]
    fn first_word_is_borrowed_from_multiple_words() {
        assert_eq!(first_word("Rust ownership"), "Rust");
    }
}
```

Use the reference code to check your work. Passing these local tests only covers these inputs; it is not a score certified by this website.
