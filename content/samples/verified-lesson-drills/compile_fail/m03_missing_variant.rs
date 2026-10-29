// Expected E0004: introducing a variant requires reconsidering match arms.
enum State {
    Queued,
    Running,
    Finished,
}

fn ready(state: State) -> bool {
    match state {
        State::Queued => true,
        State::Running => false,
    }
}

fn main() {
    println!("{}", ready(State::Finished));
}
