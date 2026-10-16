# M01-L04：最小单元测试项目

安装 Rust 1.95.0 后，在本目录运行：

```text
cargo +1.95.0 fmt -- --check
cargo +1.95.0 check --all-targets
cargo +1.95.0 test
```

`src/lib.rs` 定义 `normalize_name`，测试调用该函数并断言混合大小写输入会转为小写。为了检查测试是否真正保护行为，可临时将函数改成直接返回原文本，确认测试失败后恢复实现并重跑。最终应保留行为断言；`assert!(true)` 不能代替它。
