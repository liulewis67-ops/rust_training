// M06-L04 — E0597: a local borrowed str is not a 'static value.
fn retain_type<T: 'static>(_value: T) {}
fn main() {
    let text = String::from("request");
    retain_type(text.as_str());
}
