//! M03-L01: a named struct does not enforce validity until constructors guard it.
#[derive(Debug, PartialEq, Eq)]
pub struct Rectangle { width: u16, height: u16 }
impl Rectangle {
    pub fn new(width: u16, height: u16) -> Option<Self> {
        if width == 0 || height == 0 { None } else { Some(Self { width, height }) }
    }
    pub fn set_size(&mut self, width: u16, height: u16) -> bool {
        if width == 0 || height == 0 { return false; }
        self.width = width;
        self.height = height;
        true
    }
    pub fn area(&self) -> u32 { u32::from(self.width) * u32::from(self.height) }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn construction_rejects_zero_and_handles_large_values() {
        assert_eq!(Rectangle::new(0, 10), None);
        assert_eq!(Rectangle::new(10, 0), None);
        assert_eq!(Rectangle::new(8, 5).unwrap().area(), 40);
        assert_eq!(Rectangle::new(u16::MAX, u16::MAX).unwrap().area(), 4_294_836_225);
    }
    #[test]
    fn failed_mutation_does_not_corrupt_the_previous_valid_state() {
        let mut shape = Rectangle::new(8, 5).unwrap();
        assert!(!shape.set_size(0, 5));
        assert_eq!(shape.area(), 40);
        assert!(shape.set_size(6, 7));
        assert_eq!(shape.area(), 42);
    }
}
