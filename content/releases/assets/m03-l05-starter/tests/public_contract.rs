use memory_task_list::{TaskList, TaskStatus, UpdateOutcome};

#[test]
fn adds_tasks_with_sequential_ids_and_todo_status() {
    let mut list = TaskList::new();

    let first = list.add_task("write outline");
    let second = list.add_task("review examples");

    assert_eq!(first, 1);
    assert_eq!(second, 2);
    assert_eq!(
        list.get(first).map(|task| task.status()),
        Some(TaskStatus::Todo)
    );
}

#[test]
fn returns_task_details_and_none_for_an_unknown_id() {
    let mut list = TaskList::new();
    let id = list.add_task("check the lesson");

    let task = list.get(id).expect("the inserted task should be present");
    assert_eq!(task.id(), id);
    assert_eq!(task.title(), "check the lesson");
    assert_eq!(task.status(), TaskStatus::Todo);
    assert!(list.get(404).is_none());
}

#[test]
fn updates_each_supported_status() {
    let mut list = TaskList::new();
    let id = list.add_task("run the examples");

    assert_eq!(list.set_status(id, "doing"), UpdateOutcome::Updated);
    assert_eq!(
        list.get(id).map(|task| task.status()),
        Some(TaskStatus::Doing)
    );
    assert_eq!(list.set_status(id, "done"), UpdateOutcome::Updated);
    assert_eq!(
        list.get(id).map(|task| task.status()),
        Some(TaskStatus::Done)
    );
    assert_eq!(list.set_status(id, "todo"), UpdateOutcome::Updated);
    assert_eq!(
        list.get(id).map(|task| task.status()),
        Some(TaskStatus::Todo)
    );
}

#[test]
fn rejects_invalid_status_without_changing_the_task() {
    let mut list = TaskList::new();
    let id = list.add_task("keep the current state");
    assert_eq!(list.set_status(id, "doing"), UpdateOutcome::Updated);

    assert_eq!(list.set_status(id, "blocked"), UpdateOutcome::InvalidStatus);
    assert_eq!(
        list.get(id).map(|task| task.status()),
        Some(TaskStatus::Doing)
    );
}

#[test]
fn distinguishes_missing_tasks_from_invalid_status_text() {
    let mut list = TaskList::new();

    assert_eq!(list.set_status(404, "done"), UpdateOutcome::TaskNotFound);
    assert_eq!(
        list.set_status(404, "blocked"),
        UpdateOutcome::InvalidStatus
    );
}
