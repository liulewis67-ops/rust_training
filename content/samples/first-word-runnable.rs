/// Return the first whitespace-delimited word without copying the input.
fn first_word(text: &str) -> &str {
    text.split_whitespace().next().unwrap_or("")
}

/// Print a deterministic result for the course sample runner.
fn main() {
    println!("first word: {}", first_word("Rust ownership"));
}
