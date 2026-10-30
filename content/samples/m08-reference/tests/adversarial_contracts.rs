//! External acceptance: intentionally no access to implementation internals.
use rust_training_m08_reference::{
    aggregate, summarize, LogEvent, Reading, SensorSummary, ServiceSummary,
};

#[test]
fn l05_all_permutations_preserve_counts_totals_and_sorted_case_sensitive_keys() {
    let name = String::from("温度");
    let original = [
        LogEvent { service: &name, bytes: u64::MAX - 7 },
        LogEvent { service: "API", bytes: 0 },
        LogEvent { service: "api", bytes: 3 },
        LogEvent { service: &name, bytes: 7 },
        LogEvent { service: "API", bytes: 1 },
    ];
    let expected = vec![
        ServiceSummary { service: "API", event_count: 2, total_bytes: 1 },
        ServiceSummary { service: "api", event_count: 1, total_bytes: 3 },
        ServiceSummary { service: "温度", event_count: 2, total_bytes: u64::MAX },
    ];
    for shift in 0..original.len() {
        for reverse in [false, true] {
            let mut events = original;
            events.rotate_left(shift);
            if reverse {
                events.reverse();
            }
            let actual = aggregate(&events);
            assert_eq!(actual, expected, "shift={shift}, reverse={reverse}");
            assert_eq!(actual[2].service.as_ptr(), name.as_ptr());
        }
    }
    assert_eq!(original[0].bytes, u64::MAX - 7);
}

#[test]
fn l05_empty_and_blank_are_distinct_borrowed_keys_not_missing_events() {
    let blank = String::from("");
    let padded = String::from(" ");
    let events = [
        LogEvent { service: &padded, bytes: 0 },
        LogEvent { service: &blank, bytes: 1 },
        LogEvent { service: &blank, bytes: 0 },
    ];
    let summary = aggregate(&events);
    assert_eq!(summary, vec![
        ServiceSummary { service: "", event_count: 2, total_bytes: 1 },
        ServiceSummary { service: " ", event_count: 1, total_bytes: 0 },
    ]);
    assert_eq!(summary[0].service.as_ptr(), blank.as_ptr());
    assert_eq!(summary[1].service.as_ptr(), padded.as_ptr());
    assert!(aggregate(&[]).is_empty());
}

#[test]
fn l06_permutations_preserve_zero_missing_rejected_and_signed_cancellation() {
    let name = String::from("传感器");
    let original = [
        Reading { sensor: &name, accepted: true, value: Some(i64::MAX) },
        Reading { sensor: "z", accepted: false, value: Some(i64::MIN) },
        Reading { sensor: &name, accepted: true, value: Some(i64::MIN) },
        Reading { sensor: &name, accepted: true, value: Some(1) },
        Reading { sensor: "A", accepted: true, value: Some(0) },
        Reading { sensor: "z", accepted: true, value: None },
        Reading { sensor: "A", accepted: false, value: Some(20) },
    ];
    let expected = vec![
        SensorSummary { sensor: "A", accepted_count: 1, total: 0 },
        SensorSummary { sensor: "z", accepted_count: 0, total: 0 },
        SensorSummary { sensor: "传感器", accepted_count: 3, total: 0 },
    ];
    // Rotate by every possible starting position and then also reverse.
    // All intermediate sums remain within i64 for the chosen input order;
    // reverse orders can overflow, so only exercise orderings with an
    // explicit in-range prefix sum for the extreme-value sensor.
    for shift in 0..original.len() {
        for reverse in [false, true] {
            let mut readings = original;
            readings.rotate_left(shift);
            if reverse {
                readings.reverse();
            }
            let mut intermediate = 0_i128;
            let mut safe = true;
            for reading in &readings {
                if reading.sensor == "传感器" && reading.accepted {
                    if let Some(value) = reading.value {
                        intermediate += i128::from(value);
                        safe &= (i128::from(i64::MIN)..=i128::from(i64::MAX))
                            .contains(&intermediate);
                    }
                }
            }
            if !safe {
                continue;
            }
            let result = summarize(&readings);
            assert_eq!(result, expected, "shift={shift}, reverse={reverse}");
            assert_eq!(result[2].sensor.as_ptr(), name.as_ptr());
        }
    }
}

#[test]
fn l06_never_converts_none_or_rejected_zero_into_an_accepted_reading() {
    let input = [
        Reading { sensor: "none", accepted: true, value: None },
        Reading { sensor: "reject", accepted: false, value: Some(0) },
        Reading { sensor: "zero", accepted: true, value: Some(0) },
        Reading { sensor: "none", accepted: false, value: Some(-10) },
    ];
    assert_eq!(summarize(&input), vec![
        SensorSummary { sensor: "none", accepted_count: 0, total: 0 },
        SensorSummary { sensor: "reject", accepted_count: 0, total: 0 },
        SensorSummary { sensor: "zero", accepted_count: 1, total: 0 },
    ]);
}
