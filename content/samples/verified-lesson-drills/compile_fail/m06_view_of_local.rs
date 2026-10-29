// M06-L03 — E0515: a borrowed view of a local String cannot escape.
struct AlertView<'a> { code: &'a str, detail: &'a str }
fn build() -> AlertView<'static> {
    let raw = String::from("R20|worker restarted");
    let (code, detail) = raw.split_once('|').unwrap();
    AlertView { code, detail }
}
fn main() { let _ = build(); }
