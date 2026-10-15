# M10-L01 练习：workspace 与模块边界

## 1. 预测：workspace member 能否直接被导入？

仓库根的 `Cargo.toml` 声明 `crates/profile-core` 和 `crates/profile-cli` 是 workspace members。CLI 的 `main.rs` 写了 `use profile_core::render_profile_report;`，但 `profile-cli/Cargo.toml` 没有 `[dependencies]`。预测 `cargo check -p profile-cli` 是成功还是失败；指出 Cargo 和 rustc 分别还缺少什么关系。

**提示**：workspace 管理哪些 package？哪张清单声明当前 package 能使用另一个 crate？

**验证契约**：正确答案说明编译失败，通常报告 unresolved import/crate；member 列表不自动成为 Rust 依赖。修复是从 CLI 声明 `profile-core = { path = "../profile-core" }`。加上路径依赖后，CLI 可单独构建。

## 2. 修复：打破 package 循环并把呈现放对位置

当前 workspace 声明两条依赖：`profile-core → profile-cli` 和 `profile-cli → profile-core`。`profile-core` 还用 `profile_cli::TerminalStyle` 选择终端颜色格式，但该 core 函数也被 API handler 使用。修改 package 依赖和职责分配，使 Cargo 图无环；core 保留领域格式/校验，CLI 决定终端颜色与输出。

**提示**：箭头表示“依赖并使用”。core 是可复用能力，还是终端 adapter？哪一个 package 适合拥有 TerminalStyle？

**验证契约**：core 的清单不再依赖 CLI；CLI 单向依赖 core；core 函数不接收 CLI 专属类型。`cargo check --workspace --offline`、两个 `cargo check -p ... --offline` 都应通过。仅删掉 CLI 对 core 的依赖、让业务代码失去 core 能力不算修复。

## 3. 实现：完成 core crate 的最小外部 Interface

示例的 `profile-core/src/lib.rs` 已声明 `mod name;` 与 `mod report;`，但还没有公开项。补齐重导出，让 CLI 能调用 `render_profile_report` 并匹配 `ProfileNameError`；实现模块仍保持私有，不能把 `ProfileName` 或字段扩展到外部。

~~~rust
mod name;
mod report;

// TODO: 只重导出 CLI 需要的报告函数及其错误类型。
~~~

外部契约测试使用：

~~~rust
use profile_core::{ProfileNameError, render_profile_report};

assert_eq!(
    render_profile_report("training_user"),
    Ok("profile=training_user".to_owned())
);
assert_eq!(
    render_profile_report("two names"),
    Err(ProfileNameError::InvalidCharacters)
);
~~~

**提示**：实现模块可以留在私有名字空间中；通过 `pub use` 选择性重导出。

**验证契约**：CLI 和外部集成测试均能只用固定的函数与错误类型；验证成功/失败结果，且不需要访问 `profile_core::name` 或 `profile_core::report`。全 workspace 和两个 package 单独检查均通过。解释为什么成员身份、Rust 模块可见性和 Cargo path dependency 是三个不同概念。
