// M03-L04 — E0616: a sibling module cannot access a private field.
mod task_api {
    pub struct Task { state: bool }
    impl Task { pub fn new() -> Self { Self { state: false } } }
}
fn main() {
    let task = task_api::Task::new();
    println!("{}", task.state);
}
