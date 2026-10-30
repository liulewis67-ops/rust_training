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
2. **实验级 L05**：M01–M07 的**七份真实发行 ZIP**现在通过 `scripts/verify-starter-zips.py` 在隔离临时目录执行安全解包、压缩包 CRC 检查、M02–M07 逐文件 SHA-256 清单检查、原始故障复现、最小修复和压缩包原有公开测试；M01–M03 还单独复现“编译已通过但业务仍失败”的中间阶段。M01-L06 参考 ZIP 另行验证测试和 CLI 运行。M08/M09 原 starter/reference 由既有专用脚本检查；`mXX_capstone` 仍只是额外行为契约对照。
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

# 验证原始 ZIP 的安全性、校验和、故障阶段、修复后测试，以及 M01-L06 参考 ZIP
python3 scripts/verify-starter-zips.py

# 9 个模块的错误实现变异：必须能编译，但被行为测试拒绝
python3 scripts/verify-lesson-mutations.py

# 原有 M08/M09 起始/参考工程检查
node scripts/verify-m08-labs.mjs
node scripts/verify-m09-labs.mjs
```

## 下一次质量评审重点

即使覆盖率达到 54/54，仍应区分“有配套验证样例”与“每个 Markdown 代码块、每个 ZIP 快照、每套学生独立实现都已实测”。现在 ZIP 已能逐一清洁解包、校验清单并在临时目录重演修复，9 个模块各有一个可编译但错误的实现会被合同断言抓住。后续仍需：逐段验证所有 Markdown 代码块、扩充 ZIP 原始公开测试的变异案例、教学练习盲测以及实际网页阅读审查。

课程用例与解释按模块独立设计，跨模块统一项目仅留给未来 M10，不提前发布。
