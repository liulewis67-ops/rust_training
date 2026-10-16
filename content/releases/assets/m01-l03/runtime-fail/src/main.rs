/// Parses a sample value and prints the resulting count.
fn main() {
    let raw = "not-a-number";
    let value = raw
        .parse::<u32>()
        .expect("input must be an unsigned integer");
    println!("{value}");
}
