# 本地练习：返回第一个单词

使用 Rust 1.95.0 与 Edition 2024。把页面上的可运行示例复制到一个新的 Cargo 项目 `src/main.rs`，在项目根目录运行：

```sh
rustup toolchain install 1.95.0
cargo +1.95.0 new borrowed-text --edition 2024
cd borrowed-text
cargo +1.95.0 test
```

练习时为 `first_word` 添加空字符串、无空格文本和多个单词的测试。函数返回的 `&str` 借用输入文本；不要返回指向函数局部 `String` 的切片。

`borrow-conflict-compile-fail.rs` 是预期编译失败的独立例子，不要把它放进同一 Cargo 项目的正常目标中。预期诊断是共享借用仍被使用时，不能同时创建可变借用（E0502）。

## 参考实现

在 `src/main.rs` 的 `first_word` 函数后添加测试模块，再运行 `cargo +1.95.0 test`，应有 3 项测试通过：

```rust
#[cfg(test)]
mod tests {
    use super::first_word;

    #[test]
    fn empty_text_has_no_word() {
        assert_eq!(first_word(""), "");
    }

    #[test]
    fn one_word_is_returned_unchanged() {
        assert_eq!(first_word("Rust"), "Rust");
    }

    #[test]
    fn first_word_is_borrowed_from_multiple_words() {
        assert_eq!(first_word("Rust ownership"), "Rust");
    }
}
```

参考代码可用于自查；本地测试通过只说明这些输入被覆盖，不代表网站认证成绩。
