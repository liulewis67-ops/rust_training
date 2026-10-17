# M06 已发布内容来源与许可审查

审查日期：2026-10-17。范围是发布清单中的 M06-L01–L06 六篇课文、L01–L04 四份配套练习和 M06-L05 起始项目 ZIP。不包括 `content/drafts/` 的其他文件或课程包。

逐篇核对正式课文的来源段、发布标题、练习、实验契约和起始项目文件清单。来源链接用于核验 Rust 引用有效性、生命周期省略、借用结构体、`'static` 和 `Cow` 的语义；课程说明、场景、练习、提示、参考答案、实验契约和公开测试由本项目编写。未发现复制的第三方课程段落、代码或媒体。第三方来源许可不由本项目的 CC BY 4.0 声明取代。

| 发布课文 | 核验来源 |
| --- | --- |
| `m06-l01.md` | Rust Book：References and Borrowing、The Slice Type；Rust Reference：Destructors |
| `m06-l02.md` | Rust Book：Validating References with Lifetimes；Rust Reference：Lifetime elision |
| `m06-l03.md` | Rust Book：Structs That Hold References、References and Borrowing；标准库：`str::split_once`、`ToOwned` |
| `m06-l04.md` | Rust Book：The `'static` Lifetime；Rust Reference：Lifetime bounds；Rust By Example：Static |
| `m06-l05.md` | Rust Book：Structs That Hold References；标准库：`str::split_once`、`ToOwned` |
| `m06-l06.md` | 标准库：`Cow`；Rust Book：The Slice Type；Rust Reference：Lifetime bounds |

四份练习的题目、提示和逐题参考答案均为原创，并引用对应官方语义来源。L05 ZIP 是无第三方依赖的 Rust 2024 库项目；公开契约与测试为原创。发行清单记录文件 SHA-256；发布核验同时比对压缩包和源文件，并以 Rust 1.95.0 复现预期起始类型错误及参考修复。

新版本若加入外部文本、代码、图像或资源，应重新审查并更新此记录。
