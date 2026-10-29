// M04-L01 — E0040: direct calls to Drop::drop are not allowed.
struct Guard;
impl Drop for Guard { fn drop(&mut self) {} }
fn main() {
    let mut guard = Guard;
    Drop::drop(&mut guard);
}
