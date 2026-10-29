// Expected E0308: the block returns () instead of the declared i32.
fn adjusted(value: i32) -> i32 {
    value + 1;
}

fn main() {
    println!("{}", adjusted(4));
}
