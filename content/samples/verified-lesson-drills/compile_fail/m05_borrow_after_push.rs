// Expected E0502: the old element borrow is still used after mutation.
fn main() {
    let mut queue = vec![String::from("first")];
    let first = &queue[0];
    queue.push(String::from("second"));
    println!("{first}");
}
