// M01-L03 — E0308: a compiler error, before runtime or test execution.
fn workers() -> usize {
    "three"
}
fn main() {
    println!("{}", workers());
}
