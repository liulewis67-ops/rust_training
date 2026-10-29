//! M01-L01: a Rust trial is a falsifiable engineering decision, not a performance claim.
#[derive(Debug, PartialEq, Eq)]
pub enum Decision { Trial, Reject, GatherEvidence }
pub struct Evidence {
    pub fixtures_pass: bool, pub peak_memory_mb: Option<u64>,
    pub memory_budget_mb: u64, pub rollback_plan: bool,
}
pub fn evaluate(e: &Evidence) -> Decision {
    let Some(memory) = e.peak_memory_mb else { return Decision::GatherEvidence; };
    if !e.fixtures_pass || memory > e.memory_budget_mb || !e.rollback_plan {
        Decision::Reject
    } else { Decision::Trial }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn a_language_claim_needs_measured_data_not_vibes() {
        let mut e = Evidence { fixtures_pass: true, peak_memory_mb: None, memory_budget_mb: 128, rollback_plan: true };
        assert_eq!(evaluate(&e), Decision::GatherEvidence);
        e.peak_memory_mb = Some(96);
        assert_eq!(evaluate(&e), Decision::Trial);
        e.peak_memory_mb = Some(129);
        assert_eq!(evaluate(&e), Decision::Reject);
    }
    #[test]
    fn correctness_and_operability_remain_separate_hard_constraints() {
        let mut e = Evidence { fixtures_pass: false, peak_memory_mb: Some(32), memory_budget_mb: 128, rollback_plan: true };
        assert_eq!(evaluate(&e), Decision::Reject);
        e.fixtures_pass = true;
        e.rollback_plan = false;
        assert_eq!(evaluate(&e), Decision::Reject);
    }
}
