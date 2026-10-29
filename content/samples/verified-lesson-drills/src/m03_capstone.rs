//! M03-L05: real task-list transitions; M03-L06: independent reminder decision table.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TaskStatus { Todo, Doing, Done }
pub fn parse_status(raw: &str) -> Option<TaskStatus> {
    match raw { "todo" => Some(TaskStatus::Todo), "doing" => Some(TaskStatus::Doing),
        "done" => Some(TaskStatus::Done), _ => None }
}
#[derive(Debug)]
pub struct Task { pub id: u32, pub title: String, pub status: TaskStatus }
#[derive(Default)]
pub struct TaskList { tasks: Vec<Task> }
#[derive(Debug, PartialEq, Eq)]
pub enum UpdateOutcome { Updated, TaskNotFound, InvalidStatus }
impl TaskList {
    pub fn add(&mut self, title: &str) -> u32 {
        let id = u32::try_from(self.tasks.len()).unwrap() + 1;
        self.tasks.push(Task { id, title: title.into(), status: TaskStatus::Todo });
        id
    }
    pub fn get(&self, id: u32) -> Option<&Task> { self.tasks.iter().find(|t| t.id == id) }
    pub fn set_status(&mut self, id: u32, raw: &str) -> UpdateOutcome {
        let Some(status) = parse_status(raw) else { return UpdateOutcome::InvalidStatus; };
        let Some(task) = self.tasks.iter_mut().find(|t| t.id == id)
            else { return UpdateOutcome::TaskNotFound; };
        task.status = status;
        UpdateOutcome::Updated
    }
}
#[derive(Clone, Copy)]
pub enum AlertStatus { Queued, Claimed, Delivered { attempts: u8 }, Cancelled { by_user: bool } }
pub fn next_action(status: Option<AlertStatus>) -> &'static str {
    match status {
        None => "not found",
        Some(AlertStatus::Queued) => "claim",
        Some(AlertStatus::Claimed) => "deliver",
        Some(AlertStatus::Delivered { attempts }) if attempts < 2 => "retry",
        Some(AlertStatus::Delivered { .. }) => "archive",
        Some(AlertStatus::Cancelled { by_user: true }) => "close",
        Some(AlertStatus::Cancelled { by_user: false }) => "review",
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn l05_add_lookup_and_update_are_distinct_contracts() {
        let mut tasks = TaskList::default();
        assert_eq!(tasks.add("first"), 1);
        assert_eq!(tasks.add("second"), 2);
        assert_eq!(tasks.get(1).unwrap().title, "first");
        assert_eq!(tasks.get(99).map(|t| &t.title), None);
        assert_eq!(tasks.set_status(1, "done"), UpdateOutcome::Updated);
        assert_eq!(tasks.get(1).unwrap().status, TaskStatus::Done);
    }
    #[test]
    fn l05_invalid_status_precedes_lookup_and_does_not_mutate_state() {
        let mut tasks = TaskList::default();
        let id = tasks.add("task");
        assert_eq!(tasks.set_status(999, "blocked"), UpdateOutcome::InvalidStatus);
        assert_eq!(tasks.set_status(999, "done"), UpdateOutcome::TaskNotFound);
        assert_eq!(tasks.set_status(id, "Done"), UpdateOutcome::InvalidStatus);
        assert_eq!(tasks.get(id).unwrap().status, TaskStatus::Todo);
    }
    #[test]
    fn l06_all_reminder_cases_include_both_data_bearing_boundaries() {
        assert_eq!(next_action(None), "not found");
        assert_eq!(next_action(Some(AlertStatus::Queued)), "claim");
        assert_eq!(next_action(Some(AlertStatus::Claimed)), "deliver");
        for attempts in [0, 1] {
            assert_eq!(next_action(Some(AlertStatus::Delivered { attempts })), "retry");
        }
        for attempts in [2, u8::MAX] {
            assert_eq!(next_action(Some(AlertStatus::Delivered { attempts })), "archive");
        }
        assert_eq!(next_action(Some(AlertStatus::Cancelled { by_user: true })), "close");
        assert_eq!(next_action(Some(AlertStatus::Cancelled { by_user: false })), "review");
    }
}
