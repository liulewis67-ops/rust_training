# M07 已发布内容来源与许可审查

审查日期：2026-10-17。范围是发布清单中的 M07-L01–L06 六篇课文、L01–L04 四份配套练习和 M07-L05 起始项目 ZIP。不包括 `content/drafts/` 的其他文件或课程包。

逐篇核对正式课文的来源段、发布标题、练习、实验契约和起始项目文件清单。官方来源用于核验泛型与 trait bound、关联类型、泛型/动态分发、dyn compatibility、转换 trait、新类型约束和字符串分割语义；课程解释、场景、题面、提示、参考答案、实验契约与公开测试由本项目编写。未发现复制的第三方课程段落、代码或媒体。第三方来源许可不由本项目的 CC BY 4.0 声明取代。

| 发布课文 | 核验来源 |
| --- | --- |
| `m07-l01.md` | Rust Book：Generic Data Types、Traits as Parameters；Rust Reference：Trait and lifetime bounds |
| `m07-l02.md` | Rust Book：Traits；Rust Reference：Traits、Associated items、Trait implementations |
| `m07-l03.md` | Rust Book：Using Trait Objects；Rust Reference：Trait objects、Dyn compatibility |
| `m07-l04.md` | Rust Book：Advanced Types；标准库：`From`、`TryFrom`；Rust Reference：Orphan rules |
| `m07-l05.md` | Rust Reference：Traits；标准库：`str::split_once` |
| `m07-l06.md` | Rust Book：Using Trait Objects；Rust Reference：Trait objects、Dyn compatibility |

四份练习的题目、提示和逐题参考答案均为原创，并引用对应官方语义来源。L05 ZIP 是无第三方依赖的 Rust 2024 库项目；公开契约与测试为原创。发行清单记录文件 SHA-256；发布核验同时比对压缩包和源文件，并以 Rust 1.95.0 验证预期公开测试失败及参考修复。

新版本若加入外部文本、代码、图像或资源，应重新审查并更新此记录。
