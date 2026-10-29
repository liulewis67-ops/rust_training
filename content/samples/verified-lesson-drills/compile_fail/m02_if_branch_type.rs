// M02-L03 — E0308: if expression branches must agree on a type.
fn label(active: bool) -> &'static str {
    if active { "ready" } else { () }
}
fn main() { println!("{}", label(true)); }
