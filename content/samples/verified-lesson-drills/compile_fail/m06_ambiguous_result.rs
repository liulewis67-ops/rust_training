// Expected E0106: either borrowed input may become the output.
fn choose(left: &str, right: &str, prefer_left: bool) -> &str {
    if prefer_left { left } else { right }
}

fn main() {
    println!("{}", choose("a", "bb", false));
}
