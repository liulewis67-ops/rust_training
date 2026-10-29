//! M04-L01: Drop occurs at concrete scope boundaries, including explicit drop.
use std::{cell::RefCell, rc::Rc};
struct Marker { label: &'static str, log: Rc<RefCell<Vec<&'static str>>> }
impl Drop for Marker {
    fn drop(&mut self) { self.log.borrow_mut().push(self.label); }
}
pub fn drop_order() -> Vec<&'static str> {
    let log = Rc::new(RefCell::new(Vec::new()));
    let outer = Marker { label: "outer", log: Rc::clone(&log) };
    {
        let _first = Marker { label: "first", log: Rc::clone(&log) };
        let _last = Marker { label: "last", log: Rc::clone(&log) };
    }
    assert_eq!(&*log.borrow(), &["last", "first"]);
    std::mem::drop(outer);
    let result = log.borrow().clone();
    result
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn nested_scopes_drop_in_reverse_declaration_order() {
        assert_eq!(drop_order(), ["last", "first", "outer"]);
    }
    #[test]
    fn explicit_drop_executes_the_callback_once() {
        let log = Rc::new(RefCell::new(Vec::new()));
        let item = Marker { label: "early", log: Rc::clone(&log) };
        std::mem::drop(item);
        assert_eq!(&*log.borrow(), &["early"]);
    }
}
