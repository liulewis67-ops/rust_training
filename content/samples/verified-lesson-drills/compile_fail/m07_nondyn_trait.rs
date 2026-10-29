// M07-L03 — E0038: generic trait methods prevent dyn dispatch.
trait Renderer {
    fn render<T: std::fmt::Display>(&self, value: T) -> String;
}
struct Plain;
impl Renderer for Plain {
    fn render<T: std::fmt::Display>(&self, value: T) -> String {
        value.to_string()
    }
}
fn use_dyn(value: &dyn Renderer) { let _ = value; }
fn main() { use_dyn(&Plain); }
