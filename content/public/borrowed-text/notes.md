# 本地练习：返回第一个单词

使用 Rust 1.95 与 Edition 2024。把示例复制到一个新的 Cargo 项目 `src/main.rs`，在项目根目录运行：

```sh
cargo new borrowed-text
cd borrowed-text
cargo test
```

练习时为 `first_word` 添加空字符串、无空格文本和多个单词的测试。函数返回的 `&str` 借用输入文本；不要返回指向函数局部 `String` 的切片。

`borrow-conflict-compile-fail.rs` 是预期编译失败的独立例子，不要把它放进同一 Cargo 项目的正常目标中。预期诊断是共享借用仍被使用时，不能同时创建可变借用（E0502）。
