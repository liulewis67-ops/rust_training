# M10-L04：依赖、feature、版本锁与文档

## 学完后

- 区分 Cargo.toml 的依赖范围与 Cargo.lock 的精确解析结果。
- 定义用途清楚、默认行为稳定且可组合的 Cargo feature。
- 同时验证默认构建和启用 feature 后的行为，不让配置组合只停留在“能编译”。
- 从干净解压包使用锁文件和离线命令重现构建、测试与文档。

## 先修

完成 M10-L03，能为真实 CLI 进程定义输入和输出契约。feature 是编译期构建选择，不等同于用户运行时的 CLI 参数或配置选项。

## 清单描述范围，锁文件记录解析结果

Cargo.toml 写作者维护的包元数据、Rust 版本、依赖和允许的版本范围；Cargo.lock 由 Cargo 维护实际解析到的精确版本与依赖图。不要手改 Cargo.lock，也不要因为想复现一次构建就在 Cargo.toml 里给每个依赖写精确版本。应用或 workspace 通常提交锁文件；可复用 library package 的使用者则会在自己的依赖图中解析版本。

样例 workspace 只有本地 profile-core path dependency，没有外部 crate。Cargo.lock 仍由 Cargo 生成并提交到样例 ZIP；这能演示锁文件与 workspace 成员的解析结果。使用 --locked 的命令若发现需要改写锁文件会报错，离线提取后的 check/test/doc 因而能证明包体和锁文件一致，不会悄悄重新解析或访问网络。

~~~text
cargo check --workspace --locked --offline
cargo test --workspace --locked --offline
cargo doc --workspace --all-features --no-deps --locked --offline
~~~

锁文件负责复现，不是安全审查结果：若将来添加依赖，仍要评估来源、维护状况、MSRV、许可证和 feature 组合。

## Feature 是可组合的构建能力

样例 CLI 声明一个空默认集合和一个 feature：

~~~toml
[features]
default = []
trace-input-source = []
~~~

默认运行时报告只写成功内容到 stdout，stderr 保持为空。启用 trace-input-source 后，程序增加一行所选来源诊断到 stderr；stdout 的 profile 报告和失败退出码契约不变。它是可附加的诊断能力，不改已有输出，也不改变 API。

Cargo 在编译时通过 cfg(feature = "trace-input-source") 选择这段代码。Feature 应增加能力，避免互斥地删改另一个 feature 提供的行为；同一依赖经多条路径被启用的 features 会合并。因此，不要把终端用户随时能改变的格式或颜色偏好编码成互斥 feature，使用运行时参数或配置更合适。

显式覆盖默认 feature 的组合：

~~~text
cargo test --workspace --no-default-features --locked --offline
cargo test -p profile-cli --features trace-input-source --locked --offline
cargo test --workspace --all-features --locked --offline
cargo tree -e features --offline
~~~

测试在默认模式断言成功 stderr 为空；开启 trace-input-source 后，测试断言 stderr 有来源标签且 stdout 完全不变。测试行为比只看编译成功更能证明 feature 分支的实际契约。工程随 feature 组合数增长，应明确主要支持的组合并在 CI 中覆盖，而不是假设默认构建替所有组合背书。

## 文档要与可构建配置同步

README 说明每个公开 feature 是否默认开启、它对用户可观察行为的影响及相应运行命令。Library 文档说明公开 API 与错误行为；Cargo doc 生成本 workspace 的 API 文档。修改 feature 名、默认集合或对外行为时，同时更新 Cargo.toml、README、相关测试和课包命令；不要只改其中一处。

独立解压 ZIP 后运行上述 locked/offline 命令。记录 Cargo.lock 的 SHA-256 前后相同，feature-enabled stderr 与默认行为都由子进程测试检验，能将可复现性和行为差异分别证实。

## 分层提示

1. **依赖提示**：哪个文件表达可接受的版本范围？哪个文件由 Cargo 固定已解析结果？
2. **feature 提示**：启用后增加了什么能力？默认契约是否仍有效？两个 feature 同时开启是否安全？
3. **行为提示**：检查的是 stderr 的来源诊断，还是不小心改变 stdout 主结果？
4. **复现提示**：clean extract 应带 Cargo.lock；使用 --locked 禁止锁文件改写，--offline 禁止联网取包。
5. **文档提示**：用户能否从 README 查到 feature 的默认状态、效果和准确命令？

## 来源

- [Cargo Book：Features](https://doc.rust-lang.org/cargo/reference/features.html)
- [Cargo Book：Cargo.toml vs Cargo.lock](https://doc.rust-lang.org/cargo/guide/cargo-toml-vs-cargo-lock.html)
- [Cargo Book：cargo test](https://doc.rust-lang.org/cargo/commands/cargo-test.html)
- [Cargo Book：cargo doc](https://doc.rust-lang.org/cargo/commands/cargo-doc.html)

官方资料用于核对 feature 条件编译、默认与 feature 合并语义、锁文件维护和 Cargo 命令。trace-input-source 与样例契约为原创。
