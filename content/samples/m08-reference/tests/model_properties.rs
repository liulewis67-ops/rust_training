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
        let expected = group_oracle(&events);
        let actual = aggregate(&events);
        assert_eq!(actual, expected, "seed={SEED:#x}, case={case}, input={events:?}");
        let backwards: Vec<_> = events.iter().copied().rev().collect();
        assert_eq!(
            aggregate(&backwards), expected,
            "reverse invariant; seed={SEED:#x}, case={case}, input={events:?}"
        );
        if !events.is_empty() {
            let mut rotated = events.clone();
            rotated.rotate_left(case % len);
            assert_eq!(aggregate(&rotated), expected, "rotation invariant; case={case}");
        }
        let mut with_zero = events.clone();
        with_zero.push(LogEvent { service: "api", bytes: 0 });
        assert_eq!(
            aggregate(&with_zero), group_oracle(&with_zero),
            "adding a zero-byte event still counts as an event; case={case}"
        );
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
        let expected = sensor_oracle(&readings);
        assert_eq!(
            summarize(&readings), expected,
            "seed={SEED:#x}, case={case}, input={readings:?}"
        );
        let backwards: Vec<_> = readings.iter().copied().rev().collect();
        assert_eq!(summarize(&backwards), expected, "reverse invariant; case={case}");
        if !readings.is_empty() {
            let mut rotated = readings.clone();
            rotated.rotate_left(case % len);
            assert_eq!(summarize(&rotated), expected, "rotation invariant; case={case}");
        }
        let mut with_rejected = readings.clone();
        with_rejected.push(Reading {
            sensor: "ghost", accepted: false, value: Some(1000),
        });
        assert_eq!(
            summarize(&with_rejected), sensor_oracle(&with_rejected),
            "rejected-only rows still exist; case={case}"
        );
    }
}
