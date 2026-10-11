/// Demonstrate why a mutable borrow conflicts with a live immutable borrow.
fn main() {
    let mut text = String::from("Rust");
    let borrowed = &text;
    text.push_str(" training");
    println!("{borrowed}");
}
