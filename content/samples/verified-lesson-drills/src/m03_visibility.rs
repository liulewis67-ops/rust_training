//! M03-L04: callers interact through an invariant-preserving public API.
pub mod tasks {
    #[derive(Debug, PartialEq, Eq)]
    enum State { Open, Closed }
    pub struct Task { state: State }
    impl Default for Task {
        fn default() -> Self { Self::new() }
    }
    impl Task {
        pub fn new() -> Self { Self { state: State::Open } }
        pub fn close(&mut self) { self.state = State::Closed; }
        pub fn is_closed(&self) -> bool { matches!(self.state, State::Closed) }
    }
}
mod client {
    pub fn task_can_be_closed_from_another_module() -> bool {
        let mut task = super::tasks::Task::new();
        task.close();
        task.is_closed()
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn public_methods_allow_the_required_state_transition() {
        assert!(client::task_can_be_closed_from_another_module());
    }
    #[test]
    fn a_new_task_is_open_and_close_is_idempotent() {
        let mut task = tasks::Task::new();
        assert!(!task.is_closed());
        task.close();
        task.close();
        assert!(task.is_closed());
    }
}
