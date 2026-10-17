# M05 已发布内容来源与许可审查

审查日期：2026-10-17。范围是发布清单中的 M05-L01–L06 六篇课文、L01–L04 四份配套练习和 M05-L05 起始项目 ZIP。不包括 `content/drafts/` 的其他文件或课程包。

逐篇核对正式课文的来源段、发布标题、练习、实验契约和起始项目文件清单。来源链接用于验证 Rust 借用、切片、UTF-8 和标准库语义；课程说明、时间线、代码示例、练习题面、提示、参考答案、实验契约与公开测试由本项目编写。未发现复制的第三方课程段落、代码或媒体。第三方来源许可不由本项目的 CC BY 4.0 声明取代。

| 发布课文 | 核验来源 |
| --- | --- |
| `m05-l01.md` | Rust Book：References and Borrowing；Rust Reference：Borrow operators |
| `m05-l02.md` | Rust Book：References and Borrowing；Rust Reference：Borrow operators |
| `m05-l03.md` | Rust Book：The Slice Type、Strings；标准库：`str::split_whitespace`、`str::len` |
| `m05-l04.md` | Rust Book：References and Borrowing、Vectors；标准库：`Vec` |
| `m05-l05.md` | Rust Book：The Slice Type；标准库：`str::split_whitespace` |
| `m05-l06.md` | Rust Book：The Slice Type；标准库：`str::find`、`str::get` |

四份练习的题目、提示和逐题参考答案均为原创，并引用对应官方语义来源。L05 ZIP 是无第三方依赖的 Rust 2024 库项目；公开契约与测试为原创。发行清单记录文件 SHA-256；发布核验同时比对压缩包和源文件，并以 Rust 1.95.0 复现预期生命周期错误及参考修复。

新版本若加入外部文本、代码、图像或资源，应重新审查并更新此记录。
