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
// Third wave: new verified explanations for another lesson in every module.
pub mod m01_toolchain;
pub mod m02_control;
pub mod m03_visibility;
pub mod m04_scope;
pub mod m05_api;
pub mod m06_views;
pub mod m07_dispatch;
pub mod m08_closures;
pub mod m09_boundaries;

// Capstone wave: nine independent module-level L05/L06 contract pairs.
pub mod m01_capstone;
pub mod m02_capstone;
pub mod m03_capstone;
pub mod m04_capstone;
pub mod m05_capstone;
pub mod m06_capstone;
pub mod m07_capstone;
pub mod m08_capstone;
pub mod m09_capstone;
