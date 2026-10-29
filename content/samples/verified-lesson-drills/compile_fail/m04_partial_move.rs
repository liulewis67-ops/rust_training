// M04-L04 — E0382: a field was moved and the old field cannot be read.
struct Ticket { title: String, body: String }
fn main() {
    let ticket = Ticket { title: "alert".into(), body: "ready".into() };
    let title = ticket.title;
    println!("{}", title);
    println!("{}", ticket.title);
}
