# I03-F01-A · Windows 本机修复与验证

- 日期：2026-10-15
- 环境：Windows PowerShell；Rust toolchain 由 `backend/rust-toolchain.toml` 锁定
- 范围：修复 JSON 编码后合法最大 `stdin` 超出 HTTP body 限制的问题；未调用执行器、Docker 或 Linux 容器。

## 问题复现

`stdin` 字段的逻辑字节上限为 64 KiB。以 64 KiB NUL 字符作为输入时，JSON 将每个字符编码为六字节 `\\u0000`，请求体约为 384 KiB。原 140 KiB HTTP body 限制在字段校验前返回 413，拒绝了逻辑长度仍在允许范围内的请求。

新增的 `accepts_maximum_stdin_with_json_control_character_escapes` 测试在修复前失败，实测 HTTP 状态码为 413，预期为 201。

## 修复与验证

- 将请求体限制设为最大 `stdin` 字节数的六倍，并预留受限标识符及 JSON 字段开销。
- `cargo test --manifest-path backend/Cargo.toml accepts_maximum_stdin_with_json_control_character_escapes`：通过；最大合法转义输入创建排队任务。
- `pnpm check:backend`：格式、编译、严格 Clippy、工作区 Rust 测试和 Rust 文档检查通过。
- `git diff --check`：通过。

修复只扩大 JSON 封套的容量限制；业务字段仍执行 64 KiB `stdin` 和 64 KiB 源码限制。该结果不替代 R1 worker 或 Linux 隔离验收。
