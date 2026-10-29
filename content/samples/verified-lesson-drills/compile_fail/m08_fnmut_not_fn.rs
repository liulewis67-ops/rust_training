// M08-L02 — E0525: mutating a captured variable requires FnMut, not Fn.
fn twice<F: Fn() -> u32>(f: F) -> (u32, u32) { (f(), f()) }
fn main() {
    let mut value = 0;
    let next = || { value += 1; value };
    let _ = twice(next);
}
