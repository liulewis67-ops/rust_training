//! M04-L04: moving one owned field leaves other fields accessible.
#[derive(Debug)]
pub struct Ticket {
    pub title: String,
    pub body: String,
    pub priority: u8,
}
pub fn split_ticket(ticket: Ticket) -> (String, String, u8) {
    let title = ticket.title;
    let body = ticket.body;
    (title, body, ticket.priority)
}
pub fn update_body(ticket: Ticket) -> Ticket {
    let Ticket { title, body, priority } = ticket;
    Ticket { title, body: format!("{body}!"), priority }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn moving_two_fields_keeps_copy_priority_available() {
        let ticket = Ticket { title: "alert".into(), body: "ready".into(), priority: 2 };
        assert_eq!(split_ticket(ticket), ("alert".into(), "ready".into(), 2));
    }
    #[test]
    fn ownership_can_be_reassembled_without_cloning_string_fields() {
        let ticket = Ticket { title: "status".into(), body: "ok".into(), priority: 1 };
        let changed = update_body(ticket);
        assert_eq!((&*changed.title, &*changed.body, changed.priority), ("status", "ok!", 1));
    }
}
