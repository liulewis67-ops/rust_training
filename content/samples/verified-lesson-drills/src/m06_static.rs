//! M06-L04: T: 'static is NOT a promise that the value is never dropped.
use std::{cell::Cell, rc::Rc};
pub fn require_static_type<T: 'static>(value: T) -> T { value }
struct DropSignal(Rc<Cell<bool>>);
impl Drop for DropSignal {
    fn drop(&mut self) { self.0.set(true); }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn owned_string_satisfies_static_type_bound_without_living_forever() {
        let owned = String::from("request");
        assert_eq!(require_static_type(owned), "request");
        let literal: &'static str = "ready";
        assert_eq!(require_static_type(literal), "ready");
    }
    #[test]
    fn a_static_bound_value_can_be_dropped_now() {
        let signal = Rc::new(Cell::new(false));
        let owned = require_static_type(DropSignal(Rc::clone(&signal)));
        assert!(!signal.get());
        drop(owned);
        assert!(signal.get());
    }
}
