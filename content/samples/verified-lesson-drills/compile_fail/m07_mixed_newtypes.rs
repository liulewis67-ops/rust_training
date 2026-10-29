// M07-L04 — E0308: identical u64 representations do not merge domains.
struct AccountId(u64);
struct RetryCount(u64);
fn fetch_account(_id: AccountId) {}
fn main() {
    fetch_account(RetryCount(3));
}
