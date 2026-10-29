// M07-L01: a generic T does not guarantee comparison operators (E0369).
fn greater<T>(left: T, right: T) -> T {
    if left >= right { left } else { right }
}
fn main() { println!("{}", greater(1, 2)); }
