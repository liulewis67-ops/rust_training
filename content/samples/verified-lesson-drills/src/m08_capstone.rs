//! M08-L05: group counts and sort; M08-L06: independently classify sensor readings.
use std::collections::HashMap;
#[derive(Debug, Clone, Copy)]
pub struct LogEvent<'a> { pub service: &'a str, pub bytes: u64 }
#[derive(Debug, PartialEq, Eq)]
pub struct ServiceSummary<'a> {
    pub service: &'a str, pub event_count: u64, pub total_bytes: u64
}
pub fn aggregate<'a>(events: &[LogEvent<'a>]) -> Vec<ServiceSummary<'a>> {
    let mut map: HashMap<&'a str, (u64, u64)> = HashMap::new();
    for event in events {
        let entry = map.entry(event.service).or_insert((0, 0));
        entry.0 += 1;
        entry.1 += event.bytes;
    }
    let mut output: Vec<_> = map.into_iter().map(|(service, (event_count, total_bytes))|
        ServiceSummary { service, event_count, total_bytes }).collect();
    output.sort_unstable_by_key(|s| s.service);
    output
}
#[derive(Debug, Clone, Copy)]
pub struct Reading<'a> {
    pub sensor: &'a str, pub accepted: bool, pub value: Option<i64>
}
#[derive(Debug, PartialEq, Eq)]
pub struct SensorSummary<'a> {
    pub sensor: &'a str, pub accepted_count: u64, pub total: i64
}
pub fn summarize<'a>(readings: &[Reading<'a>]) -> Vec<SensorSummary<'a>> {
    let mut map: HashMap<&'a str, (u64, i64)> = HashMap::new();
    for reading in readings {
        let totals = map.entry(reading.sensor).or_insert((0, 0));
        if reading.accepted {
            if let Some(value) = reading.value {
                totals.0 += 1;
                totals.1 += value;
            }
        }
    }
    let mut result: Vec<_> = map.into_iter().map(|(sensor, (accepted_count, total))|
        SensorSummary { sensor, accepted_count, total }).collect();
    result.sort_unstable_by_key(|s| s.sensor);
    result
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn l05_duplicate_names_accumulate_and_report_is_sorted() {
        let events = [
            LogEvent { service: "api", bytes: 10 }, LogEvent { service: "web", bytes: 2 },
            LogEvent { service: "api", bytes: 5 },
        ];
        assert_eq!(aggregate(&events), vec![
            ServiceSummary { service: "api", event_count: 2, total_bytes: 15 },
            ServiceSummary { service: "web", event_count: 1, total_bytes: 2 },
        ]);
        assert!(aggregate(&[]).is_empty());
        assert_eq!(aggregate(&[LogEvent { service: "中文", bytes: 0 }])[0].service, "中文");
        assert_eq!(events[0].service, "api"); // Input remains usable.
    }
    #[test]
    fn l06_accepted_zero_is_counted_but_rejected_sensors_remain_visible() {
        let input = [
            Reading { sensor: "z", accepted: false, value: Some(8) },
            Reading { sensor: "a", accepted: true, value: Some(0) },
            Reading { sensor: "a", accepted: true, value: None },
            Reading { sensor: "a", accepted: true, value: Some(-3) },
            Reading { sensor: "z", accepted: false, value: None },
        ];
        assert_eq!(summarize(&input), vec![
            SensorSummary { sensor: "a", accepted_count: 2, total: -3 },
            SensorSummary { sensor: "z", accepted_count: 0, total: 0 },
        ]);
        assert!(summarize(&[]).is_empty());
        assert_eq!(input[1].value, Some(0));
    }
}
