// Expected E0053: trait implementation returns the wrong output type.
trait Label {
    type Text;
    fn label(&self) -> Self::Text;
}

struct RetryCount(u8);

impl Label for RetryCount {
    type Text = String;
    fn label(&self) -> u8 {
        self.0
    }
}

fn main() {}
