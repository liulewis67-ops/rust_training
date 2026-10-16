//! Stores a small task list in memory.

/// The supported lifecycle states for a task.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TaskStatus {
    Todo,
    Doing,
    Done,
}

/// The outcome of requesting a task status change.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UpdateOutcome {
    Updated,
    TaskNotFound,
    InvalidStatus,
}

/// A task whose fields are read through methods.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Task {
    id: u32,
    title: String,
    status: TaskStatus,
}

impl Task {
    /// Returns the stable identifier assigned by the list.
    pub fn id(&self) -> u32 {
        self.id
    }

    /// Returns the task title.
    pub fn title(&self) -> &str {
        &self.title
    }

    /// Returns the current lifecycle state.
    pub fn status(&self) -> TaskStatus {
        self.status
    }
}

/// An in-memory collection of tasks.
#[derive(Debug)]
pub struct TaskList {
    tasks: Vec<Task>,
    next_id: u32,
}

impl TaskList {
    /// Creates an empty task list whose first task receives identifier 1.
    pub fn new() -> Self {
        Self {
            tasks: Vec::new(),
            next_id: 1,
        }
    }

    /// Adds a task and returns its assigned identifier.
    pub fn add_task(&mut self, title: &str) -> u32 {
        let id = self.next_id;
        self.next_id += 1;
        self.tasks.push(Task {
            id,
            title: String::from(title),
            status: TaskStatus::Todo,
        });
        id
    }

    /// Looks up a task by identifier.
    pub fn get(&self, id: u32) -> Option<&Task> {
        // TODO: Find the task with this identifier and return it.
        let _ = id;
        None
    }

    /// Parses and applies a status update, reporting invalid input or a missing task.
    pub fn set_status(&mut self, id: u32, status_text: &str) -> UpdateOutcome {
        let status = match parse_status(status_text) {
            Some(status) => status,
            None => return UpdateOutcome::InvalidStatus,
        };

        for task in &mut self.tasks {
            if task.id == id {
                task.status = status;
                return UpdateOutcome::Updated;
            }
        }

        UpdateOutcome::TaskNotFound
    }
}

fn parse_status(status_text: &str) -> Option<TaskStatus> {
    match status_text {
        "todo" => TaskStatus::Todo,
        "doing" => TaskStatus::Doing,
        "done" => TaskStatus::Done,
        _ => None,
    }
}
