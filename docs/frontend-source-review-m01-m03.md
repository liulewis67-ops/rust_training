# M01–M03 已发布内容来源与许可审查

审查日期：2026-10-17。范围是 `content/releases/` 中首批 18 份正式课文、随课练习、6 个公开 ZIP，以及公开课包 `content/public/borrowed-text/`。本记录只覆盖发布清单已批准的内容，不代表 `content/drafts/` 或其他未发布资产经过审查。

逐份检查了 18 篇正式课文的“来源”段、公开清单引用及可下载起始项目。来源链接用于指向概念、语法和标准库行为的权威说明；课程叙述、学习目标、题目、提示、原创示例和自测答案由本项目编写。审查未发现逐字复制或直接改编的第三方课程段落、代码或媒体。公开 JSON 课包的来源许可状态和改编说明记录在 `content/borrowed-text.course.json`；实际公开笔记在 `content/public/borrowed-text/notes.md`。正式课文保留其逐篇来源链接，第三方来源的许可不由本项目的 CC BY 4.0 声明取代。

| 发布文件 | 课文“来源”段所列材料 |
| --- | --- |
| `m01-l01.md` | Rust Book：Introduction、Getting Started |
| `m01-l02.md` | Rust Book：Installation、Hello Cargo；Rustup：Overriding the toolchain |
| `m01-l03.md` | Rust Book：Hello Cargo、How to Write Tests |
| `m01-l04.md` | Rust Book：How to Write Tests；Cargo Book：cargo test；Clippy 文档 |
| `m01-l05.md` | Rust Book：Data Types、How to Write Tests |
| `m01-l06.md` | Rust Book：Hello Cargo、How to Write Tests |
| `m02-l01.md` | Rust Book：Variables and Mutability、Data Types |
| `m02-l02.md` | Rust Book：Functions；Rust Reference：Statements and expressions |
| `m02-l03.md` | Rust Book：Control Flow；Rust Reference：Loop expressions |
| `m02-l04.md` | Rust Book：Data Types；Rust Reference：Array types、Tuple expressions、Patterns、Array expressions |
| `m02-l05.md` | Rust 标准库：`str::parse`、`u64::checked_mul` |
| `m02-l06.md` | Rust 标准库：`u32::checked_add` |
| `m03-l01.md` | Rust Book：Defining and Instantiating Structs、Method Syntax |
| `m03-l02.md` | Rust Book：Defining an Enum、The `match` Control Flow Construct |
| `m03-l03.md` | Rust Book：Option、The `match` Control Flow Construct |
| `m03-l04.md` | Rust Book：Control Scope and Privacy with Modules；Rust Reference：Visibility and Privacy |
| `m03-l05.md` | Rust Book：Vectors、Strings |
| `m03-l06.md` | Rust Book：Defining an Enum、The `match` Control Flow Construct |

6 个 ZIP 均是本项目维护的 Cargo 练习项目；M02-L05 和 M03-L05 包含标准库代码及本项目编写的公开契约，没有额外 crate 依赖。已用 manifest 哈希核对两份发布源目录与 ZIP，并在 Rust 1.95.0 上验证其预期起始失败和参考修复。M01 ZIP 与逐项核验记录见[首模块发布核验](./frontend-release-m01.md)。

软件依赖许可另见[站点第三方许可清单](../public/third-party-notices.txt)。后续发布新文件时，贡献者仍须逐文件补来源、权属和许可判断；本审查不替代未来批次的审查。
