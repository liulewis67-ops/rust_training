# M10-L01：Cargo workspace 与模块边界

> **本节核心问题：** 两个 crate 放进同一个 workspace 后，CLI 就能直接调用库了吗？

## 学习目标

- 区分 Cargo workspace、package、crate 与 Rust `mod` 模块各自负责什么。
- 让 workspace 中的 library package 和 binary package 分别构建，并通过显式 path dependency 协作。
- 将依赖保持为单向图；让库实现隐藏在小而稳定的外部 interface 后。
- 只公开 CLI 真正调用的项，保留模块内字段和辅助实现的私有性。

## 先修与环境

完成 M09-L06，能区分库内领域错误与调用边界呈现；会读 `Cargo.toml`、`use`、`mod` 和 `pub`。本节样例不添加第三方依赖。

## 场景：把 CLI 与领域逻辑分成两个 crate

一个工具的 `profile-core` 负责数据处理，`profile-cli` 负责解析命令和展示结果。两者放在一个 Cargo workspace 中能统一管理构建，但不自动建立依赖方向。

**先预测：** 只在根清单的 `[workspace].members` 写入两个包，`profile-cli` 能直接导入 `profile_core::render_profile_report` 吗？如果 core 反过来依赖 cli，会发生什么？

## Workspace 聚合 package，不替 package 建立依赖

Cargo workspace 把多个 package 放在一个仓库中共同管理，成员共用根目录的 `Cargo.lock` 和构建输出目录，也能从根运行 `cargo check --workspace`。一个 virtual workspace 根清单只有 `[workspace]`、没有 `[package]`；它需要显式写 resolver。Edition 2024 示例使用 resolver 3：

~~~toml
[workspace]
members = ["crates/profile-core", "crates/profile-cli"]
resolver = "3"
~~~

`profile-core` 和 `profile-cli` 出现在 `members` 中，只表示它们属于同一个 workspace。CLI 源码若要导入 `profile_core`，仍要在 CLI 自己的清单中声明依赖：

~~~toml
[dependencies]
profile-core = { path = "../profile-core" }
~~~

去掉这项声明仍会因 crate 找不到而编译失败。反过来，workspace 中只有 CLI 依赖 core；core 不能再依赖 CLI，否则 Cargo package 图形成环，Cargo 会拒绝解析。CLI 格式化终端文字，core 承担可复用的领域校验与结果生成，这样依赖方向清楚。

## 这四个层次各管一件事

| 名称 | 管理什么 | 样例 |
|---|---|---|
| Workspace | 一组 package 的共同 Cargo 配置、锁文件和命令 | 根 `Cargo.toml` |
| Package | 有自己清单与版本的可发布单元，能含多个 crate target | `profile-core` package |
| Crate | 一次编译形成的库或程序及其名字空间根 | `profile_core` library crate、`profile_cli` binary crate |
| Rust module | crate 内部的名字组织、可见性和实现文件 | `mod name;`、`mod report;` |

把文件拆进 `src/name.rs` 不会创建新 package，也不需要 workspace path dependency；它仍属于同一 crate。把 library 与 CLI 拆成两个 package 后，二者需要通过一条显式的 Cargo 依赖协作。

## 用小接口隐藏实现

示例 ZIP 包含完整、可构建的 `profile-core` / `profile-cli` workspace。`profile-core/src/lib.rs` 只把报告函数和它返回的错误类型重导出：

~~~rust
mod name;
mod report;

pub use name::ProfileNameError;
pub use report::render_profile_report;
~~~

`name` 和 `report` 模块本身并不公开；有效名称的内部表示、字段和访问方法也不需要给 CLI。调用者只了解 `render_profile_report(&str)` 的成功/失败契约。这里的 Module 是整个 core crate；它的 Interface 包含函数签名和错误语义，Implementation 把解析与格式化细节放在私有模块中。较小的 Interface 隐藏了更多 Implementation，形成更深的 Module，为调用者带来 Leverage，也让维护变化集中在 core 内部，保持 Locality。

把所有内容都设为 `pub` 会把文件布局和内部类型变成调用者依赖，之后改名或重组就更难。也不需要为一个固定实现提前造出可替换 Adapter 或 trait；只有存在真实变化点和实际替代实现时，才值得建立 Seam。Cargo crate 适合需要独立编译、依赖方向或复用边界的情形；普通实现文件用 `mod` 归组即可。

## 独立构建与接口检查

在示例 ZIP 根目录运行：

~~~text
cargo check --workspace --offline
cargo check -p profile-core --offline
cargo check -p profile-cli --offline
cargo test --workspace --offline
~~~

按 package 分别构建证明它们能独立作为目标编译；workspace 测试同时验证 CLI 能通过公开 Interface 调用 core。若 `profile-core` 单独构建时找不到 CLI 类型，依赖方向已经反了；若 CLI 只能引用 core 的私有 `name` 模块，说明根 Interface 没有清楚表达需要提供的能力。

## 与 Java / Go 对比

Java 多模块构建、Go workspace 与 Rust Cargo workspace 都有“共同管理项目”与“声明模块依赖”之分。Rust 的 `workspace.members` 管理成员，`[dependencies]` 才决定 crate 可用性，`mod` 则属于 crate 内的源码模块树。

依赖应从 CLI 指向领域核心；领域核心不需要认识 stdout、参数解析或进程退出码。
## 检验理解与本地练习

**预测 → 验证：** 故意从 CLI 清单中移除 core 的 path dependency，运行 `cargo check -p profile-cli` 观察编译错误。恢复依赖后，尝试从 CLI 直接访问 core 私有模块，再改用公开重导出的稳定 API。

**验收标准：** 能画出 workspace / package / crate / module 四层关系，以及 core → CLI 的反向依赖为何不合适。
## 分层提示

1. **Cargo 提示**：成员关系记录在哪里？调用 package 与被调用 package 是否有明确的依赖边？
2. **图提示**：从 CLI 到 core 画箭头；core 是否又绕回 CLI？去掉哪条边可以让编译依赖成为有向无环图？
3. **Rust 可见性提示**：CLI 实际需要哪些类型/函数？crate 根能否只重导出这些项，而把实现模块保持为 `mod`？
4. **拆分粒度提示**：新 package 是否带来独立构建、依赖约束或复用的实际收益？如果只是让每个源文件多一个 manifest，拆分可能太浅。
5. **参考验证**：从 workspace 根分别检查 core、CLI 和全体成员；再检查外部测试只能通过刻意导出的函数与错误类型工作。

## 本节小结

- 让项目结构或工具链配置服务于清晰的接口契约。
- 先记录预期，再用编译器、子进程或行为测试观察实际结果。
- 避免为了让代码通过而扩大公开 API、删除错误处理或污染正常输出。

## 来源

- [Cargo Book：Workspaces](https://doc.rust-lang.org/cargo/reference/workspaces.html)
- [The Rust Programming Language：Cargo Workspaces](https://doc.rust-lang.org/book/ch14-03-cargo-workspaces.html)
- [The Rust Programming Language：Modules and Privacy](https://doc.rust-lang.org/book/ch07-02-defining-modules-to-control-scope-and-privacy.html)

Workspace 和可见性资料用于核对 Cargo 成员/路径依赖、resolver 与 Rust 模块隐私；样例项目与场景为原创。
