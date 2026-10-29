// M05-L04 — E0502: old element views cannot span mutation of the Vec.
fn main() {
    let mut queue = vec![String::from("first")];
    let first_view = queue.first().unwrap().as_str();
    queue.push(String::from("second"));
    println!("{first_view}");
}
