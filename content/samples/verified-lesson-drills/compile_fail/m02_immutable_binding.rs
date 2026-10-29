// M02-L01: immutable binding reassignment must be rejected with E0384.
fn main() {
    let attempts = 3;
    attempts = 4;
    println!("{attempts}");
}
