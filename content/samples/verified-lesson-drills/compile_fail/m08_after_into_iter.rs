// M08-L03 — E0382: consuming owned Vec removes the old binding.
fn main() {
    let tasks = vec![String::from("ready")];
    let moved: Vec<String> = tasks.into_iter().collect();
    println!("{} / {}", moved.len(), tasks.len());
}
