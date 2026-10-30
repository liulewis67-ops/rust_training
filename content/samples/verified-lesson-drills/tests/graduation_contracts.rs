//! Independent graduation checks: intentionally separate from the inline
//! student TODO / empty-test templates and from the starter ZIP fixtures.
use rust_path_verified_lesson_drills::{
    m06_capstone, m07_capstone, m08_capstone, m09_capstone,
};
use std::{borrow::Cow, cell::RefCell, rc::Rc};

#[test]
fn m06_l06_borrow_or_own_is_observable_without_instrumenting_an_allocator() {
    for input in ["#rust", "##rust", "#你好", "#"] {
        let output = m06_capstone::normalize_topic(input);
        match output {
            Cow::Borrowed(suffix) => {
                assert_eq!(suffix, &input[1..]);
                assert_eq!(suffix.as_ptr(), input[1..].as_ptr());
            }
            Cow::Owned(_) => panic!("already prefixed input must borrow"),
        }
    }
    for (input, expected) in [("", "#"), ("rust", "#rust"), ("你好", "#你好")] {
        let output = m06_capstone::normalize_topic(input);
        assert!(matches!(&output, Cow::Owned(_)));
        assert_eq!(output.as_ref(), expected);
    }
}

struct RecordingGate {
    id: &'static str,
    outcome: Result<(), &'static str>,
    calls: Rc<RefCell<Vec<&'static str>>>,
}
impl m07_capstone::Gate for RecordingGate {
    fn evaluate(&self, _build: &m07_capstone::Build) -> Result<(), String> {
        self.calls.borrow_mut().push(self.id);
        self.outcome.map_err(str::to_owned)
    }
}

#[test]
fn m07_l06_dyn_gate_order_first_error_and_no_late_calls() {
    let build = m07_capstone::Build { number: 0, channel: "β".into() };
    let calls = Rc::new(RefCell::new(Vec::new()));
    let cases: [(&str, Result<(), &str>); 4] = [
        ("first", Ok(())), ("reject-β", Err("blocked:β")),
        ("must-not-run", Err("unexpected")), ("last", Ok(())),
    ];
    let gates: Vec<Box<dyn m07_capstone::Gate>> = cases
        .into_iter()
        .map(|(id, outcome)| Box::new(RecordingGate {
            id,
            outcome,
            calls: Rc::clone(&calls),
        }) as Box<dyn m07_capstone::Gate>)
        .collect();
    assert_eq!(
        m07_capstone::evaluate_pipeline(&gates, &build),
        Err("blocked:β".into()),
    );
    assert_eq!(*calls.borrow(), ["first", "reject-β"]);
    calls.borrow_mut().clear();
    assert!(m07_capstone::evaluate_pipeline(&[], &build).is_ok());
    assert!(calls.borrow().is_empty());
    let accepted: Vec<Box<dyn m07_capstone::Gate>> = vec![
        Box::new(m07_capstone::MinimumNumber(0)),
        Box::new(m07_capstone::ChannelIs("β".into())),
    ];
    assert_eq!(m07_capstone::evaluate_pipeline(&accepted, &build), Ok(()));
}

#[test]
fn m08_l06_accepted_zero_missing_and_rejected_only_have_different_counts() {
    use m08_capstone::{Reading, SensorSummary};
    let readings = [
        Reading { sensor: "z", accepted: false, value: Some(i64::MIN) },
        Reading { sensor: "a", accepted: true, value: Some(0) },
        Reading { sensor: "a", accepted: true, value: None },
        Reading { sensor: "a", accepted: true, value: Some(-1) },
        Reading { sensor: "z", accepted: false, value: None },
    ];
    let rows = m08_capstone::summarize(&readings);
    assert_eq!(rows, vec![
        SensorSummary { sensor: "a", accepted_count: 2, total: -1 },
        SensorSummary { sensor: "z", accepted_count: 0, total: 0 },
    ]);
    assert_eq!(rows[0].sensor.as_ptr(), readings[1].sensor.as_ptr());
    assert_eq!(rows[1].sensor.as_ptr(), readings[0].sensor.as_ptr());
}

#[test]
fn m09_l06_public_errors_keep_trace_id_and_redact_private_causes() {
    use m09_capstone::HistoryError;
    let error = HistoryError::StorageUnavailable(
        "db://admin:password@internal.example/sql SELECT".into(),
    );
    for request_id in ["", "事件-🧭", "long/request-id-with punctuation"] {
        let response = m09_capstone::present_api(&error, request_id);
        assert_eq!(response.request_id, request_id);
        assert_eq!((response.status, response.code, response.retryable),
            (503, "storage_unavailable", true));
        for field in [response.code, response.message] {
            for secret in ["admin", "password", "internal.example", "SELECT"] {
                assert!(!field.contains(secret));
            }
        }
    }
    let cli = m09_capstone::present_cli(&error);
    assert_eq!(cli.exit_code, 1);
    assert!(!cli.stderr.contains("password"));
    for nonretryable in [HistoryError::InvalidRetention, HistoryError::ProfileMissing] {
        assert!(!m09_capstone::present_api(&nonretryable, "req").retryable);
    }
}
