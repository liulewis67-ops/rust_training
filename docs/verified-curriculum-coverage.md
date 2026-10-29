# Rust M01–M09: Verifiable Course Coverage and Graduation Evidence

此报告记录全部已发布 **54 节课（中英文共 108 份课程正文）**与配套 Rust 可运行证据的对应关系。L01–L04 为概念课的正例、反例和迁移测试；L05 与 L06 虽同在一个 capstone 测试模块中，却使用**不同的公共函数、输入输出契约与测试函数**，不能拿 L05 的修复实现冒充 L06 的独立完成。

## 覆盖矩阵

下表是 `content/samples/verified-lesson-drills/src/` 下的 Rust 文件名（不含 `.rs`），L05/L06 后缀是过滤用的测试名称；`src/content/course-verified-coverage.test.ts` 自动验证每节中英文课程链接与这个矩阵一致，且对应源码确实存在。

| Module | L01 | L02 | L03 | L04 | L05 laboratory | L06 independent check |
| --- | --- | --- | --- | --- | --- | --- |
| M01 | `m01_decision` | `m01_toolchain` | `m01_diagnostics` | `m01` | `m01_capstone::tests::l05_` | `m01_capstone::tests::l06_` |
| M02 | `m02_bindings` | `m02` | `m02_control` | `m02_shapes` | `m02_capstone::tests::l05_` | `m02_capstone::tests::l06_` |
| M03 | `m03_structs` | `m03` | `m03_missing` | `m03_visibility` | `m03_capstone::tests::l05_` | `m03_capstone::tests::l06_` |
| M04 | `m04_scope` | `m04_moves` | `m04` | `m04_partial` | `m04_capstone::tests::l05_` | `m04_capstone::tests::l06_` |
| M05 | `m05_borrows` | `m05` | `m05_utf8` | `m05_api` | `m05_capstone::tests::l05_` | `m05_capstone::tests::l06_` |
| M06 | `m06_validity` | `m06` | `m06_views` | `m06_static` | `m06_capstone::tests::l05_` | `m06_capstone::tests::l06_` |
| M07 | `m07_generics` | `m07` | `m07_dispatch` | `m07_conversion` | `m07_capstone::tests::l05_` | `m07_capstone::tests::l06_` |
| M08 | `m08_collections` | `m08_closures` | `m08_iteration` | `m08` | `m08_capstone::tests::l05_` | `m08_capstone::tests::l06_` |
| M09 | `m09_propagation` | `m09` | `m09_boundaries` | `m09_recovery` | `m09_capstone::tests::l05_` | `m09_capstone::tests::l06_` |

## 检查与证据层次

1. **概念级 L01–L04**：真实 Rust 单测覆盖类型语义、边界行为与借用/泛型等机制；`compile_fail/` 由 `rustc` 验证预期错误码，不能把故意失败的源码编进正常 crate。
2. **实验级 L05**：必须从对应课程的原始故障 ZIP 或 M08/M09 starter 开始，保存*初始失败 → 最小修复 → 边界回归*三阶段证据；配套 `mXX_capstone` 仅提供额外的可执行**行为契约对照**，没有自动测试所有 ZIP 内的文件。
3. **独立检查 L06**：先按课程签名在干净工作区独立实现，再运行对应 `mXX_capstone::tests::l06_` 进行行为对照。不得直接复制 L05 修复实现。M08、M09 的 L05/L06 同用 starter 包时，应隔离测试、保留独立实现证据，最后运行两个阶段的回归。
4. **语言与内容完整性**：所有 54 节有中文、英文课文与 Rust 源码链接，且每一对 L05/L06 有不同的教学验收要求。静态检查可以防止遗漏链接，但不能自动证明文字足够准确或学生独立完成。
5. **原有资产**：不替换旧 ZIP、公开 starter、reference 和相应脚本；CI 继续运行已有的 `scripts/verify-m08-labs.mjs` 与 `scripts/verify-m09-labs.mjs`。

## 可复现命令

从仓库根目录（Rust 1.95.0，Edition 2024）执行：

```sh
cargo +1.95.0 test --offline --manifest-path content/samples/verified-lesson-drills/Cargo.toml --lib
node scripts/verify-lesson-drills.mjs

# 对比一个模块内相互独立的两组毕业任务
cargo +1.95.0 test --offline --manifest-path content/samples/verified-lesson-drills/Cargo.toml m05_capstone::tests::l05_
cargo +1.95.0 test --offline --manifest-path content/samples/verified-lesson-drills/Cargo.toml m05_capstone::tests::l06_

# 已发布的实际起始/参考工程检查
node scripts/verify-m08-labs.mjs
node scripts/verify-m09-labs.mjs
```

## 下一次质量评审重点

即使覆盖率达到 54/54，仍应区分“有配套验证样例”与“每个 Markdown 代码块、每个 ZIP 快照、每套学生独立实现都已实测”。后续重点可以是 ZIP 全量解包重建测试、更多变异测试（证明测试会在错误实现下变红）、代码块逐个编译、教学练习盲测和实际网页阅读审查。

课程用例与解释按模块独立设计，跨模块统一项目仅留给未来 M10，不提前发布。
