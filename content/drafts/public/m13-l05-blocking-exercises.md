# M13-L05 公开实验检查

1. 从 [`m13-l05-blocking-starter.zip`](./m13-l05-blocking-starter.zip) 解压到全新目录，先读 README 与 manifest。
2. 运行 `cargo fmt -- --check`、`cargo check --locked --offline` 与 `cargo test --locked --offline`。基线应编译成功，但 `sibling_progresses_before_release` 行为断言应失败。保留首次输出。
3. 只修改 `src/lib.rs` 的 `run_gated_work`，保持工作入口/输出契约不变，让有限同步等待离开 runtime worker。
4. 重新运行公开检查。成功必须同时满足 `sibling_progressed_before_release == true` 与正确运算输出；不得改观察器、公开契约或削弱断言。
5. 留下首次失败、修复差异、验证命令和工作区快照。再从原 ZIP 解压至另一目录，确认起始失败可重复。

watchdog 仅保护失败实现不挂死。它的时间上限不是性能标准；通过由 release 前的 sibling 通道握手决定。提示：同步等待即使放进 async 函数仍会占用调用它的线程。
