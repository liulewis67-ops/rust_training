//! M07-L04: newtypes prevent identity confusion and TryFrom rejects invalid values.
#[derive(Debug, PartialEq, Eq)]
pub struct ServicePort(u16);
#[derive(Debug, PartialEq, Eq)]
pub struct InvalidPort(pub u32);
impl TryFrom<u32> for ServicePort {
    type Error = InvalidPort;
    fn try_from(value: u32) -> Result<Self, Self::Error> {
        if (1..=u16::MAX as u32).contains(&value) {
            Ok(Self(value as u16)) // Validated before narrowing.
        } else {
            Err(InvalidPort(value))
        }
    }
}
impl ServicePort {
    pub fn number(&self) -> u16 { self.0 }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn boundary_ports_are_accepted_or_rejected_with_original_value() {
        assert_eq!(ServicePort::try_from(1).unwrap().number(), 1);
        assert_eq!(ServicePort::try_from(65535).unwrap().number(), 65535);
        assert_eq!(ServicePort::try_from(0), Err(InvalidPort(0)));
        assert_eq!(ServicePort::try_from(65536), Err(InvalidPort(65536)));
    }
    #[test]
    fn unchecked_narrowing_would_silently_corrupt_the_value() {
        assert_eq!(65536_u32 as u16, 0);
        assert!(ServicePort::try_from(65536).is_err());
    }
}
