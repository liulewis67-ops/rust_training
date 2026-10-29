// M04-L02: a by-value parameter takes ownership and the old name becomes invalid (E0382).
fn consume(value: String) -> String { value }
fn main() {
    let old = String::from("ready");
    let new = consume(old);
    println!("{old} {new}");
}
