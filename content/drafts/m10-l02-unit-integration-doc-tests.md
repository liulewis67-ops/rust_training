# M10-L02：单元、集成与文档测试

> **本节核心问题：** 私有解析函数和对外报告 API，为什么需要写在不同层级的测试里？

## 学习目标

- 按照测试要回答的问题选择单元测试、集成测试或文档测试。
- 将需要检查的私有不变量留在模块内测试，并从包外验证公开契约。
- 用可执行的 API 示例同时说明并回归检查公开用法。
- 通过精准的 Cargo test 过滤器定位哪一层测试失败。

## 先修与环境

完成 M10-L01，理解 package、crate、模块和 crate 根重导出。样例沿用 profile-core：输入名称会被 trim，合法名称报告为 profile=<name>，错误通过公开的 ProfileNameError 返回。

## 场景：修复一个名称 trim 回归

`profile-core` 内部有私有的名称解析器，外部 CLI 只依赖 `render_profile_report`。当边界空白处理出了问题，单元测试应检查内部不变量，集成测试则检查外部可见契约，文档测试展示用户怎样调用 API。

**先预测：** 放在 `tests/public_contract.rs` 的集成测试，可以像 `src/name.rs` 的模块内测试一样直接调用私有方法吗？

## 测试位置决定可见边界

| 类型 | 常见位置 | 可访问范围 | 最适合回答的问题 |
|---|---|---|---|
| 单元测试 | 与实现同文件的 #[cfg(test)] mod tests | 当前模块及其可见祖先；可检验私有表示与辅助函数 | 解析器内部不变量是否成立？ |
| 集成测试 | library package 根下 tests/*.rs | 像外部 crate 一样，只通过公开 API 使用 library | 用户可调用的组合行为是否成立？ |
| 文档测试 | 公开 API 的 rustdoc 代码块 | 外部调用者可用的 API | 文档中的承诺和示例是否仍然可运行？ |

单元测试贴近实现，应该验证有意义的不变量，不必让每一个私有函数都拥有一条重复测试。集成测试故意处在 crate 外，因此不能读取私有 name 模块、ProfileName 字段或内部 helper。若集成测试为了通过而把这些实现细节改为 pub，测试已经越过了它应该守护的 Interface。

示例中 name.rs 用 #[cfg(test)] mod tests 测试 trim 后存下的私有表示；profile-core/tests/public_contract.rs 从包外检查报告函数和 typed error；report.rs 的 doctest 使用同一公开 API，作为短小且可执行的调用示例。二进制 package 的 tests 则可以启动 CARGO_BIN_EXE_profile-cli，检查 CLI 的进程输入/输出；这不等同于直接调用 library 的集成测试。

## 让每层针对同一回归，但验证不同承诺

如果 ProfileName::parse 不再 trim 输入：

- 单元测试可以精确指出内部规范化结果 name.as_str() 错了。
- 集成测试会发现用户传入首尾空格时公开报告发生变化。
- doctest 会发现已记录的公开示例和文档承诺不再成立。

三者都可能失败，但职责不同：单元测试定位私有规则，集成测试保护包外契约，doctest 同时保护 API 示例与文档。好的测试套件允许三个层次少量重叠，而不需要让每层都断言实现细节。

从 workspace 根可以分别运行：

~~~text
cargo test -p profile-core --lib
cargo test -p profile-core --test public_contract
cargo test -p profile-core --doc
cargo test -p profile-cli --test public_contract
cargo test --workspace
~~~

前三条命令只选择一类 library 测试；CLI 的集成测试启动实际二进制。执行完整 workspace suite 可检查它们一同工作。一个只让代码编译失败的检查未必证明行为回归被发现；至少要保留一处有效的错误断言，确保测试会在实现逻辑错误时失败。

## 文档示例也是可执行代码

为公开函数添加 Examples 区块，展示调用方真正能写出的内容：

~~~rust
/// Formats a validated profile name behind the core crate's stable interface.
///
/// # Examples
///
/// ```
/// use profile_core::{render_profile_report, ProfileNameError};
///
/// assert_eq!(render_profile_report(" training_user "), Ok(String::from("profile=training_user")));
/// assert_eq!(render_profile_report("bad name"), Err(ProfileNameError::InvalidCharacters));
/// ```
~~~

cargo test -p profile-core --doc 会抽取并运行 doctest。用断言表达输出契约；仅仅让片段编译通过，不能验证结果是否符合文档描述。示例也必须遵守公开可见性：如果代码只能通过私有模块访问，就不是真实消费者示例。

## 与 Java / Go 对比

Java 可在同模块测试内部逻辑，也会用独立模块测试外部 API；Go 的 `package foo` 和 `package foo_test` 显式区分包内与包外。Rust 的模块内 `#[cfg(test)]` 单元测试能访问本模块私有项，而 `tests/*.rs` 是外部集成测试 crate，只能使用公开接口。

文档测试既是帮助读者上手的示例，也是真正由 `cargo test --doc` 执行的契约。
## 检验理解与本地练习

**预测 → 验证：** 让集成测试访问私有解析器，观察错误；将该测试放回模块内，再在集成测试中只调用公开 API。用 `cargo test --lib`、`cargo test --test public_contract`、`cargo test --doc` 分别验证。

**验收标准：** 每层测试有独立目的，不为绕过私有性而公开内部表示。
## 分层提示

1. 边界提示：某个测试目录是否和源码位于同一个 crate？该测试模拟真实调用方还是实现所在模块？
2. 可见性提示：外部测试能从 crate root 导入哪些名字？不要为测试方便扩大公开 API。
3. 行为提示：改变 trim 行为时，私有表示、公开报告和文档示例分别应在哪条断言失败？
4. 运行提示：--lib、--test <target>、--doc 分别筛选哪一类目标？
5. 失败质量提示：确认错的是运行期行为断言，而不只是让示例无法编译。

## 本节小结

- 让项目结构或工具链配置服务于清晰的接口契约。
- 先记录预期，再用编译器、子进程或行为测试观察实际结果。
- 避免为了让代码通过而扩大公开 API、删除错误处理或污染正常输出。

## 来源

- [The Rust Programming Language：Test Organization](https://doc.rust-lang.org/book/ch11-03-test-organization.html)
- [The rustdoc Book：Documentation tests](https://doc.rust-lang.org/rustdoc/write-documentation/documentation-tests.html)

来源用于核对 Rust 单元/集成测试的 crate 边界、运行位置与 doctest 行为。练习场景、契约和样例项目为原创。
