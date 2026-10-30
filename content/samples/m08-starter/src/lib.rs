use std::collections::HashMap;

/// One service event borrowed from the caller.
#[derive(Debug, Clone, Copy)]
pub struct LogEvent<'a> {
    pub service: &'a str,
    pub bytes: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ServiceSummary<'a> {
    pub service: &'a str,
    pub event_count: usize,
    pub total_bytes: u64,
}

/// A sensor reading; zero is a valid value.
#[derive(Debug, Clone, Copy)]
pub struct Reading<'a> {
    pub sensor: &'a str,
    pub accepted: bool,
    pub value: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SensorSummary<'a> {
    pub sensor: &'a str,
    pub accepted_count: usize,
    pub total: i64,
}

/// Deliberate bug: inserting a repeated key overwrites its existing count.
pub fn aggregate<'a>(events: &[LogEvent<'a>]) -> Vec<ServiceSummary<'a>> {
    let mut grouped: HashMap<&'a str, (usize, u64)> = HashMap::new();
    for event in events {
        grouped.insert(event.service, (1, event.bytes));
    }
    let mut output: Vec<_> = grouped
        .into_iter()
        .map(|(service, (event_count, total_bytes))| ServiceSummary {
            service,
            event_count,
            total_bytes,
        })
        .collect();
    output.sort_by(|left, right| left.service.cmp(right.service));
    output
}

/// Deliberate bug: zero is skipped, and rejected-only sensors vanish.
pub fn summarize<'a>(readings: &[Reading<'a>]) -> Vec<SensorSummary<'a>> {
    let mut grouped: HashMap<&'a str, (usize, i64)> = HashMap::new();
    for reading in readings {
        if let (true, Some(value)) = (reading.accepted, reading.value) {
            if value != 0 {
                let entry = grouped.entry(reading.sensor).or_insert((0, 0));
                entry.0 += 1;
                entry.1 += value;
            }
        }
    }
    let mut output: Vec<_> = grouped
        .into_iter()
        .map(|(sensor, (accepted_count, total))| SensorSummary {
            sensor,
            accepted_count,
            total,
        })
        .collect();
    output.sort_by(|left, right| left.sensor.cmp(right.sensor));
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn l05_empty_input() {
        assert!(aggregate(&[]).is_empty());
    }

    #[test]
    fn l05_duplicate_services_accumulate() {
        let events = [
            LogEvent { service: "api", bytes: 10 },
            LogEvent { service: "web", bytes: 2 },
            LogEvent { service: "api", bytes: 5 },
        ];
        assert_eq!(
            aggregate(&events),
            vec![
                ServiceSummary { service: "api", event_count: 2, total_bytes: 15 },
                ServiceSummary { service: "web", event_count: 1, total_bytes: 2 },
            ]
        );
    }

    #[test]
    fn l05_unicode_keys_sort_stably() {
        let events = [
            LogEvent { service: "成功", bytes: 1 },
            LogEvent { service: "api", bytes: 3 },
        ];
        assert_eq!(aggregate(&events)[0].service, "api");
        assert_eq!(aggregate(&events)[1].service, "成功");
    }

    #[test]
    fn l06_empty_input() {
        assert!(summarize(&[]).is_empty());
    }

    #[test]
    fn l06_zero_value_counts_and_rejected_sensor_is_listed() {
        let readings = [
            Reading { sensor: "alpha", accepted: true, value: Some(0) },
            Reading { sensor: "alpha", accepted: false, value: Some(7) },
            Reading { sensor: "alpha", accepted: true, value: None },
            Reading { sensor: "beta", accepted: true, value: Some(3) },
            Reading { sensor: "gamma", accepted: false, value: Some(10) },
        ];
        assert_eq!(
            summarize(&readings),
            vec![
                SensorSummary { sensor: "alpha", accepted_count: 1, total: 0 },
                SensorSummary { sensor: "beta", accepted_count: 1, total: 3 },
                SensorSummary { sensor: "gamma", accepted_count: 0, total: 0 },
            ]
        );
    }

    #[test]
    fn l06_unicode_sorting_and_negative_readings() {
        let readings = [
            Reading { sensor: "温度", accepted: true, value: Some(-3) },
            Reading { sensor: "api", accepted: true, value: Some(2) },
            Reading { sensor: "温度", accepted: true, value: Some(1) },
        ];
        assert_eq!(
            summarize(&readings),
            vec![
                SensorSummary { sensor: "api", accepted_count: 1, total: 2 },
                SensorSummary { sensor: "温度", accepted_count: 2, total: -2 },
            ]
        );
    }

    #[test]
    fn l05_case_sensitive_extreme_bytes_and_borrowed_keys() {
        let events = [
            LogEvent { service: "API", bytes: u64::MAX },
            LogEvent { service: "api", bytes: 0 },
            LogEvent { service: "温度", bytes: 1 },
        ];
        let summary = aggregate(&events);
        assert_eq!(
            summary,
            vec![
                ServiceSummary { service: "API", event_count: 1, total_bytes: u64::MAX },
                ServiceSummary { service: "api", event_count: 1, total_bytes: 0 },
                ServiceSummary { service: "温度", event_count: 1, total_bytes: 1 },
            ],
        );
        for row in &summary {
            let source = events.iter().find(|event| event.service == row.service).unwrap();
            assert_eq!(row.service.as_ptr(), source.service.as_ptr());
        }
        assert_eq!(events[0].bytes, u64::MAX);
    }

    #[test]
    fn l05_repeated_zero_and_large_events_count_each() {
        let events = [
            LogEvent { service: "api", bytes: u64::MAX - 9 },
            LogEvent { service: "api", bytes: 0 },
            LogEvent { service: "api", bytes: 9 },
        ];
        assert_eq!(
            aggregate(&events),
            vec![ServiceSummary {
                service: "api",
                event_count: 3,
                total_bytes: u64::MAX,
            }],
        );
    }

    #[test]
    fn l06_all_rejected_and_missing_values_still_have_sorted_rows() {
        let readings = [
            Reading { sensor: "温度", accepted: false, value: Some(i64::MIN) },
            Reading { sensor: "z", accepted: true, value: None },
            Reading { sensor: "温度", accepted: false, value: None },
            Reading { sensor: "a", accepted: false, value: Some(0) },
        ];
        let summary = summarize(&readings);
        assert_eq!(
            summary,
            vec![
                SensorSummary { sensor: "a", accepted_count: 0, total: 0 },
                SensorSummary { sensor: "z", accepted_count: 0, total: 0 },
                SensorSummary { sensor: "温度", accepted_count: 0, total: 0 },
            ],
        );
        assert_eq!(summary[2].sensor.as_ptr(), readings[0].sensor.as_ptr());
    }

    #[test]
    fn l06_signed_extremes_cancel_and_input_stays_borrowed() {
        let readings = [
            Reading { sensor: "温度", accepted: true, value: Some(i64::MIN) },
            Reading { sensor: "温度", accepted: true, value: Some(i64::MAX) },
            Reading { sensor: "温度", accepted: true, value: Some(1) },
        ];
        let summary = summarize(&readings);
        assert_eq!(
            summary,
            vec![SensorSummary {
                sensor: "温度",
                accepted_count: 3,
                total: 0,
            }],
        );
        assert_eq!(summary[0].sensor.as_ptr(), readings[0].sensor.as_ptr());
        assert_eq!(readings[1].value, Some(i64::MAX));
    }
}
