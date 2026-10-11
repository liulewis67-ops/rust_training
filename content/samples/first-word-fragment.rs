let first = &text[..text.find(' ').unwrap_or(text.len())];
println!("first word: {first}");
