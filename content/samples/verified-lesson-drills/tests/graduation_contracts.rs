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
fn m07_l06_heterogeneous_gates_recheck_in_order_for_changed_builds() {
    use m07_capstone::{Build, ChannelIs, Gate, MinimumNumber};
    let calls = Rc::new(RefCell::new(Vec::new()));
    let gates: Vec<Box<dyn Gate>> = vec![
        Box::new(MinimumNumber(7)),
        Box::new(RecordingGate {
            id: "audit",
            outcome: Ok(()),
            calls: Rc::clone(&calls),
        }),
        Box::new(ChannelIs("stable".into())),
        Box::new(RecordingGate {
            id: "postcheck",
            outcome: Err("postcheck denied"),
            calls: Rc::clone(&calls),
        }),
    ];

    // The first concrete gate passes, then a traced dyn gate runs, and the
    // channel gate rejects before the last side effect.
    let beta = Build { number: 7, channel: "beta".into() };
    assert_eq!(m07_capstone::evaluate_pipeline(&gates, &beta), Err("wrong channel".into()));
    assert_eq!(*calls.borrow(), ["audit"]);

    // The same heterogeneous objects can be evaluated again; changing input
    // changes which gate first rejects, without caching the previous result.
    let stable = Build { number: 7, channel: "stable".into() };
    assert_eq!(
        m07_capstone::evaluate_pipeline(&gates, &stable),
        Err("postcheck denied".into())
    );
    assert_eq!(*calls.borrow(), ["audit", "audit", "postcheck"]);

    // If the first gate rejects, no later stateful gate may run at all.
    calls.borrow_mut().clear();
    let too_old = Build { number: 6, channel: "stable".into() };
    assert_eq!(
        m07_capstone::evaluate_pipeline(&gates, &too_old),
        Err("number too low".into())
    );
    assert!(calls.borrow().is_empty());

    // A single statically dispatched gate preserves the same business error.
    assert_eq!(m07_capstone::evaluate_one(&MinimumNumber(8), &beta), Err("number too low".into()));
    assert_eq!(m07_capstone::evaluate_one(&ChannelIs("beta".into()), &beta), Ok(()));
}

#[test]
fn m09_l05_first_failure_is_not_masked_by_a_later_bad_line() {
    use m09_capstone::{ConfigError, ParseKind};
    let error = m09_capstone::parse_config(
        "timeout_ms=1\ntimeout_ms=not-a-number\n未知=private\nretry_limit=1",
    ).unwrap_err();
    assert_eq!(error, ConfigError {
        kind: ParseKind::DuplicateField,
        line: 2,
        column: 1,
    });
    assert!(!format!("{error:?}").contains("private"));
    assert_eq!(
        m09_capstone::parse_config("timeout_ms=1\nretry_limit=256").unwrap_err(),
        ConfigError { kind: ParseKind::InvalidValue, line: 2, column: 13 },
    );
}

#[test]
fn m08_l05_repeated_borrowed_keys_max_bytes_and_stable_sort() {
    use m08_capstone::{LogEvent, ServiceSummary};
    let unicode = String::from("温度");
    let events = [
        LogEvent { service: &unicode, bytes: u64::MAX - 5 },
        LogEvent { service: "api", bytes: 0 },
        LogEvent { service: &unicode, bytes: 5 },
        LogEvent { service: "API", bytes: 1 },
    ];
    let rows = m08_capstone::aggregate(&events);
    assert_eq!(rows, vec![
        ServiceSummary { service: "API", event_count: 1, total_bytes: 1 },
        ServiceSummary { service: "api", event_count: 1, total_bytes: 0 },
        ServiceSummary { service: "温度", event_count: 2, total_bytes: u64::MAX },
    ]);
    assert_eq!(rows[2].service.as_ptr(), unicode.as_ptr());
    assert!(m08_capstone::aggregate(&[]).is_empty());
    assert_eq!(events[0].bytes, u64::MAX - 5);
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
