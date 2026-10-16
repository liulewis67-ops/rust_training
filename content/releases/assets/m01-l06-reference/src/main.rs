use amount_formatter::format_cents;

/// Prints the sample formatted amount to standard output.
fn main() {
    println!("{}", format_cents(1_234));
}
