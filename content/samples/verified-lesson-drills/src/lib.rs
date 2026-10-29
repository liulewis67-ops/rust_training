//! Executable contrasts for nine published Rust modules.
//! Every test asserts a behavior, not just a successful compilation.

pub mod m01;
pub mod m02;
pub mod m03;
pub mod m04;
pub mod m05;
pub mod m06;
pub mod m07;
pub mod m08;
pub mod m09;

// Second wave: one additional, independent lesson per module.
pub mod m01_diagnostics;
pub mod m02_shapes;
pub mod m03_missing;
pub mod m04_partial;
pub mod m05_utf8;
pub mod m06_static;
pub mod m07_conversion;
pub mod m08_iteration;
pub mod m09_propagation;
