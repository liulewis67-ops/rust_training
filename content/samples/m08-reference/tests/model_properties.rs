//! Deterministic, dependency-free property tests against a separate BTreeMap oracle.
//! These are not a random generator that changes outcome across CI runs.
use rust_training_m08_reference::{aggregate, summarize, LogEvent, Reading, SensorSummary, ServiceSummary};
use std::collections::BTreeMap;

const SEED: u64 = 0xC0FF_EE08_2026_1030;
const CASES: usize = 320;
const KEYS: [&str; 11] = ["", " ", "API", "api", "🧭", "温度", " café", "é", "e\u{301}", "Ω", "x"];

struct Generator(u64);
impl Generator {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }
    fn index(&mut self, limit: usize) -> usize {
        (self.next() % limit as u64) as usize
    }
}

fn group_oracle<'a>(events: &[LogEvent<'a>]) -> Vec<ServiceSummary<'a>> {
    // Independent sorted-map model using wider arithmetic, not the HashMap
    // implementation or its aggregation code from the reference crate.
    let mut rows: BTreeMap<&'a str, (u128, u128)> = BTreeMap::new();
    for event in events {
        let sums = rows.entry(event.service).or_default();
        sums.0 += 1;
        sums.1 += u128::from(event.bytes);
    }
    rows.into_iter().map(|(service, (count, bytes))| ServiceSummary {
        service,
        event_count: usize::try_from(count).unwrap(),
        total_bytes: u64::try_from(bytes).unwrap(),
    }).collect()
}

fn sensor_oracle<'a>(readings: &[Reading<'a>]) -> Vec<SensorSummary<'a>> {
    let mut rows: BTreeMap<&'a str, Vec<i64>> = BTreeMap::new();
    for r in readings {
        let values = rows.entry(r.sensor).or_default();
        if let (true, Some(value)) = (r.accepted, r.value) {
            values.push(value);
        }
    }
    rows.into_iter().map(|(sensor, values)| SensorSummary {
        sensor,
        accepted_count: values.len(),
        total: i64::try_from(values.iter().map(|v| i128::from(*v)).sum::<i128>()).unwrap(),
    }).collect()
}

fn shrink_by_deletion<T: Copy>(initial: &[T], differs: impl Fn(&[T]) -> bool) -> Vec<T> {
    assert!(differs(initial), "do not shrink a passing sample");
    let mut minimal = initial.to_vec();
    let mut index = 0;
    while index < minimal.len() {
        let mut smaller = minimal.clone();
        smaller.remove(index);
        if differs(&smaller) {
            minimal = smaller;
            index = 0;
        } else {
            index += 1;
        }
    }
    // 1-minimal with respect to removing any single record, NOT globally minimal.
    assert!(differs(&minimal));
    minimal
}

// After record-deletion shrinking, simplify u64 quantities. Only accept
// strictly smaller numeric candidates that preserve the exact oracle mismatch.
fn shrink_event_numbers<'a>(events: Vec<LogEvent<'a>>) -> Vec<LogEvent<'a>> {
    let mut reduced = events;
    loop {
        let mut changed = false;
        for index in 0..reduced.len() {
            let current = reduced[index].bytes;
            let candidates = [0, 1, 2, current / 2, 1024, 1025];
            for replacement in candidates {
                if replacement >= current { continue; }
                let mut candidate = reduced.clone();
                candidate[index].bytes = replacement;
                if aggregate(&candidate) != group_oracle(&candidate) {
                    reduced = candidate;
                    changed = true;
                    break;
                }
            }
            if changed { break; }
        }
        if !changed { break; }
    }
    reduced
}

// Signed sensor quantities use monotonic unsigned-magnitude reduction,
// covering i64::MIN without abs() overflow or an oscillating shrink loop.
fn shrink_sensor_numbers<'a>(readings: Vec<Reading<'a>>) -> Vec<Reading<'a>> {
    let mut reduced = readings;
    loop {
        let mut changed = false;
        for index in 0..reduced.len() {
            let Some(current) = reduced[index].value else { continue };
            let candidates = [0, current.signum(), current / 2];
            for replacement in candidates {
                if replacement.unsigned_abs() >= current.unsigned_abs() { continue }
                let mut candidate = reduced.clone();
                candidate[index].value = Some(replacement);
                if summarize(&candidate) != sensor_oracle(&candidate) {
                    reduced = candidate;
                    changed = true;
                    break;
                }
            }
            if changed { break }
        }
        if !changed { break }
    }
    reduced
}

fn check_events(events: &[LogEvent<'_>], case: usize, phase: &str) {
    let expected = group_oracle(events);
    let actual = aggregate(events);
    if actual != expected {
        let smaller = shrink_event_numbers(shrink_by_deletion(events, |candidate| aggregate(candidate) != group_oracle(candidate)));
        panic!(
            "MINIMIZED_COUNTEREXAMPLE m08/events number-reduced seed={SEED:#x} case={case} phase={phase} original={events:?} minimal={smaller:?} expected={:?} actual={:?}",
            group_oracle(&smaller), aggregate(&smaller)
        );
    }
}

fn check_readings(readings: &[Reading<'_>], case: usize, phase: &str) {
    let expected = sensor_oracle(readings);
    let actual = summarize(readings);
    if actual != expected {
        let smaller = shrink_sensor_numbers(shrink_by_deletion(readings, |candidate| summarize(candidate) != sensor_oracle(candidate)));
        panic!(
            "MINIMIZED_COUNTEREXAMPLE m08/sensor number-reduced seed={SEED:#x} case={case} phase={phase} original={readings:?} minimal={smaller:?} expected={:?} actual={:?}",
            sensor_oracle(&smaller), summarize(&smaller)
        );
    }
}

#[test]
fn model_differential_generated_aggregation_and_reordering() {
    let mut rng = Generator(SEED);
    for case in 0..CASES {
        let len = rng.index(25);
        let events: Vec<_> = (0..len).map(|_| LogEvent {
            service: KEYS[rng.index(KEYS.len())],
            bytes: match rng.index(5) {
                0 => 0,
                _ => rng.next() % 10_000,
            },
        }).collect();
        check_events(&events, case, "original");
        let backwards: Vec<_> = events.iter().copied().rev().collect();
        check_events(&backwards, case, "reverse");
        if !events.is_empty() {
            let mut rotated = events.clone();
            rotated.rotate_left(case % len);
            check_events(&rotated, case, "rotation");
        }
        let mut with_zero = events.clone();
        with_zero.push(LogEvent { service: "api", bytes: 0 });
        check_events(&with_zero, case, "zero-byte extension");
    }
}

#[test]
fn model_differential_generated_sensor_rules_and_reordering() {
    let mut rng = Generator(SEED ^ 0x09DE_FA11);
    for case in 0..CASES {
        let len = rng.index(25);
        let readings: Vec<_> = (0..len).map(|_| {
            let accepted = rng.index(4) != 0;
            let value = match rng.index(5) {
                0 => None,
                1 => Some(0),
                _ => Some((rng.next() % 2001) as i64 - 1000),
            };
            Reading { sensor: KEYS[rng.index(KEYS.len())], accepted, value }
        }).collect();
        check_readings(&readings, case, "original");
        let backwards: Vec<_> = readings.iter().copied().rev().collect();
        check_readings(&backwards, case, "reverse");
        if !readings.is_empty() {
            let mut rotated = readings.clone();
            rotated.rotate_left(case % len);
            check_readings(&rotated, case, "rotation");
        }
        let mut with_rejected = readings.clone();
        with_rejected.push(Reading {
            sensor: "ghost", accepted: false, value: Some(1000),
        });
        check_readings(&with_rejected, case, "rejected-row extension");
    }
}
