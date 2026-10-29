// M05-L01: a live shared reference cannot overlap an exclusive mutation (E0502).
fn main() {
    let mut message = String::from("ready");
    let reader = &message;
    message.push('!');
    println!("{reader}");
}
