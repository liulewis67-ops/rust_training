//! M07-L05: two parsers, one trait contract; M07-L06: independent ordered gate chain.
#[derive(Debug, PartialEq, Eq)]
pub enum ParseError { MissingSeparator, EmptyKey, EmptyValue }
pub trait EntryParser {
    fn parse(&self, text: &str) -> Result<(String, String), ParseError>;
}
fn parse_with(text: &str, sep: char) -> Result<(String, String), ParseError> {
    let (key, value) = text.split_once(sep).ok_or(ParseError::MissingSeparator)?;
    let (key, value) = (key.trim(), value.trim());
    if key.is_empty() { return Err(ParseError::EmptyKey); }
    if value.is_empty() { return Err(ParseError::EmptyValue); }
    Ok((key.into(), value.into()))
}
pub struct EqualsParser;
pub struct ColonParser;
impl EntryParser for EqualsParser {
    fn parse(&self, text: &str) -> Result<(String, String), ParseError> { parse_with(text, '=') }
}
impl EntryParser for ColonParser {
    fn parse(&self, text: &str) -> Result<(String, String), ParseError> { parse_with(text, ':') }
}
pub fn render_label<P: EntryParser>(parser: &P, text: &str) -> Result<String, ParseError> {
    let (key, value) = parser.parse(text)?;
    Ok(format!("{key}={value}"))
}
pub struct Build { pub number: u32, pub channel: String }
pub trait Gate { fn evaluate(&self, build: &Build) -> Result<(), String>; }
pub struct MinimumNumber(pub u32);
pub struct ChannelIs(pub String);
impl Gate for MinimumNumber {
    fn evaluate(&self, b: &Build) -> Result<(), String> {
        if b.number >= self.0 { Ok(()) } else { Err("number too low".into()) }
    }
}
impl Gate for ChannelIs {
    fn evaluate(&self, b: &Build) -> Result<(), String> {
        if b.channel == self.0 { Ok(()) } else { Err("wrong channel".into()) }
    }
}
pub fn evaluate_one<G: Gate>(gate: &G, b: &Build) -> Result<(), String> {
    gate.evaluate(b)
}
pub fn evaluate_pipeline(gates: &[Box<dyn Gate>], b: &Build) -> Result<(), String> {
    for gate in gates { gate.evaluate(b)?; }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::{cell::RefCell, rc::Rc};
    #[test]
    fn l05_parser_semantics_are_not_guaranteed_by_trait_implementation_alone() {
        assert_eq!(render_label(&EqualsParser, " env =stable=latest "), Ok("env=stable=latest".into()));
        assert_eq!(render_label(&ColonParser, "env:stable:latest"), Ok("env=stable:latest".into()));
        assert_eq!(render_label(&ColonParser, "中文:值"), Ok("中文=值".into()));
        assert_eq!(render_label(&ColonParser, "key=value"), Err(ParseError::MissingSeparator));
        assert_eq!(render_label(&EqualsParser, "missing"), Err(ParseError::MissingSeparator));
        assert_eq!(render_label(&EqualsParser, "=v"), Err(ParseError::EmptyKey));
        assert_eq!(render_label(&ColonParser, "k:  "), Err(ParseError::EmptyValue));
    }
    #[test]
    fn l06_order_and_first_rejection_are_observable() {
        let b = Build { number: 4, channel: "dev".into() };
        let a: Vec<Box<dyn Gate>> = vec![Box::new(MinimumNumber(5)), Box::new(ChannelIs("stable".into()))];
        let reversed: Vec<Box<dyn Gate>> = vec![Box::new(ChannelIs("stable".into())), Box::new(MinimumNumber(5))];
        assert_eq!(evaluate_pipeline(&a, &b), Err("number too low".into()));
        assert_eq!(evaluate_pipeline(&reversed, &b), Err("wrong channel".into()));
        assert_eq!(evaluate_pipeline(&[], &b), Ok(()));
        assert_eq!(evaluate_one(&MinimumNumber(4), &b), Ok(()));
    }
    struct TracedGate { name: &'static str, fail: bool, calls: Rc<RefCell<Vec<&'static str>>> }
    impl Gate for TracedGate {
        fn evaluate(&self, _build: &Build) -> Result<(), String> {
            self.calls.borrow_mut().push(self.name);
            if self.fail { Err(self.name.into()) } else { Ok(()) }
        }
    }
    #[test]
    fn l06_short_circuits_before_later_side_effects() {
        let calls = Rc::new(RefCell::new(Vec::new()));
        let gates: Vec<Box<dyn Gate>> = ["first", "second", "third"].iter().enumerate()
            .map(|(i, name)| Box::new(TracedGate {
                name, fail: i == 1, calls: Rc::clone(&calls),
            }) as Box<dyn Gate>)
            .collect();
        let b = Build { number: 1, channel: "dev".into() };
        assert_eq!(evaluate_pipeline(&gates, &b), Err("second".into()));
        assert_eq!(*calls.borrow(), ["first", "second"]);
    }
}
