# M04 已发布内容来源与许可审查

审查日期：2026-10-17。范围是发布清单中的 M04-L01–L06 六篇正式课文、L01–L04 四份配套练习和 M04-L05 起始项目 ZIP。不包括 `content/drafts/` 的其他文件或 M04 私有课包中的作者数据。

逐篇核对了正式课文的来源段、发布标题、练习、实验契约和起始项目文件清单。来源链接用于验证语言语义和标准库行为；课程说明、事件追踪、数据流图、练习题面、提示、参考答案、实验实现与公开测试由本项目编写。未发现复制的第三方课程段落、代码或媒体。正式课文保留逐篇来源链接，第三方来源许可不由本项目的 CC BY 4.0 声明取代。

| 发布课文 | 核验来源 |
| --- | --- |
| `m04-l01.md` | Rust Book：What Is Ownership?、Drop；Rust Reference：Destructors |
| `m04-l02.md` | Rust Book：What Is Ownership?；Rust Reference：Destructors |
| `m04-l03.md` | Rust Book：What Is Ownership?；Rust Reference：Special types and traits；标准库：Clone |
| `m04-l04.md` | Rust Book：What Is Ownership?；Rust Reference：Destructors |
| `m04-l05.md` | Rust Book：What Is Ownership?；标准库：String |
| `m04-l06.md` | Rust Book：What Is Ownership?；标准库：`str::len` |

四份练习的场景、题目和逐题参考答案均为原创，分别引用相关所有权、Drop、Copy／Clone 或字段移动的官方说明。L05 ZIP 是无第三方依赖的 Rust 2024 库项目；公开契约与测试为原创。发行清单列明文件 SHA-256，审查同时核对压缩包内容与源目录，并在 Rust 1.95.0 下验证预期起始编译错误和参考修复。

新模块后续修订若加入新的外部文本、代码、图像或资源，仍需重新检查并更新本记录。
