// M09-L01 — E0277: ParseIntError is not convertible into io::Error by ?.
fn parse_port(text: &str) -> Result<u16, std::io::Error> {
    let port = text.parse::<u16>()?;
    Ok(port)
}
fn main() {
    println!("{:?}", parse_port("8080"));
}
