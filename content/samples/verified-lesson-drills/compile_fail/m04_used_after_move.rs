// Expected E0382: the original binding no longer owns its String.
fn main() {
    let original = String::from("report");
    let transferred = original;
    println!("{original} / {transferred}");
}
