# Rust Training：将课程写成可阅读的技术博客

这份约定不是要把教程写成漫长的个人随笔，而是要让读者在学习一项语言机制时，能够一路回答：**我在什么工程问题下需要它？原来的实现为什么不够？Rust 的规则如何影响设计？怎样证明改动真的有效？**

## 一篇课文的阅读节奏

1. **问题真实发生在何处**。用一段有角色、输入、失败症状与业务目标的叙述开场。避免只有“本节介绍 trait、impl 和 dyn”之类的纲要。
2. **沿着推理过程逐渐揭示机制**。先预测常见实现会遇到什么，再解释为什么编译器或业务测试会拒绝它。机制是解决问题的工具，不是文章的全部目的。
3. **让示例服务于一个推导**。代码前说明它要验证哪个假设，代码后解释结果和边界。不要一口气粘贴三个互不相干的示例。
4. **讲清楚取舍与例外**。什么时候使用该方案，什么时候不值得，Java/Go 开发者为何会产生另一种直觉，以及有哪些输入可能推翻结论。
5. **以读者可执行的证据收尾**。写出运行命令、预期观察、最小反例和独立交付标准。保留完整的实验与检查章节，不用空泛的小结替代实践。

## 一个局部改写示例

**较像提纲的写法：**

> 核心知识点：HashMap 的 entry API。HashMap 是无序的。重复键会覆盖。推荐排序。

**更像技术文章的写法：**

> 监控系统要按服务统计最近一小时的流量。开发者使用 `HashMap::insert` 记录每条日志，单条样例测试顺利通过；但同一个服务出现第二次时，第一次统计悄悄消失。问题并不是 HashMap 无法聚合，而是 `insert` 表示替换，而业务真正需要的是累加。先用 `entry` 更新计数，再明确报告的展示顺序——因为数据能够按键聚合，不代表输出自然稳定。接下来用两条相同服务的日志和零字节事件验证这两条独立契约。

区别在于：后者让**情境、错误实现、机制、取舍和可执行验证**连成一个因果链。

## 第二轮：让正文推理连续起来

课程具有工程故事之后，如果正文仍以“问题、原理、示例、反例、独立练习、复盘”六个标签排开，阅读就会再次中断。应当在自然段落里串起原因、代码行为、失效路径与可运行的判断，而不是把每个知识点包装成固定问答。

代码前先提出具体预测：谁拥有字符串、哪个分支返回 Result、出现重复键时会覆盖还是累加？运行后再给出观察点、适用边界和这个示例不能证明的内容。一个通过编译的程序可能依然有业务错误，一个输出正确的示例也不能证明性能优越。

本轮对全部 54 节的中英文推导段做了这种连续论述改写，并针对 11 组 Rust 代码补充“阅读代码前先预测 / 运行或编译后观察”。原有分层提示、独立验收和代码围栏保持不变。

## 综合实验与独立检查：把任务书写成完整调试记录

M01–M09 的 L05 与 L06 不应该只有“获取 starter、修改 TODO、运行测试、提交”四个动作。它们是课程中最适合展开真实工程推理的部分，必须同时说明读者如何进入问题、如何区分失败类型、怎样排除看似合理的错误修复，以及最后如何证明自己交付的是完整行为。

**L05 综合实验**建议把原始项目作为案件现场：从第一次编译失败或公开测试失败开始，记录应观察到的现象；给出最小区分性输入；解释编译器和运行期测试能证明的不同事实；最后检查修复是否影响了其他既定行为。要保留发布 ZIP 的完整性、starter 的故意缺陷以及教师独立验收的区分，不把参考源码当成第一步。

**L06 独立检查**则从契约出发：先明确输入类型和允许的返回分支，构造恰好在边界两侧的对照例子，再自行实现并回归。与 L05 的区别是独立设计与交付，而不是再次修复前一节的 starter。写作中不应直接给出完整解答，应该解释为什么某种错误策略会失败以及如何用最小测试识别它。

两类课程都应在原理推导之后提供至少一段独立、连续的“从故障到验收”的文章正文，内容具体到本课的函数、关键输入、错误语义和验证证据，不使用六项标签式短句，也不依赖堆砌“建议多写测试”的通用建议。现有的任务、提示、自查表和可运行命令必须保留，以便读者在读完文章后确实能够实践。

## 中英文对照原则

- 两种语言都应具备完整的故事，而不只是将中文段落概括成三条英文 bullet。
- 不改变两种语言版本原有 Rust fenced code block、可运行命令、练习接口或资料链接。新增代码若确有必要，需要同时验证中英文一致性。
- 中文采用自然的技术文章语言；英文以符合英文技术写作习惯的论述传递相同的因果，不要求逐句直译。
- 小标题应描述内容与问题，例如“为什么一个 Vec 不能同时持有元素引用和修改它”，而不是“核心知识点二 / Core concept 2”。
- 避免无意义的引导语反复出现：每一节的情境和判断都应当特指该节技术约束。

## 不能牺牲的教学契约

内容变长不是唯一目标。新增段落不得声称示例已经证明未实际测量的性能，不得将 `'static` 误写成永生，不得把 `String::len()` 称为字符数，不得把编译通过等同于业务正确。有关错误源链、溢出、借用与异步行为的描述应精确对应现有工程与测试。

课程正文中的原有 **工程推进、学习目标、独立实验、反例、分层提示、边界测试和来源** 都继续保留。新增叙事承担连贯阅读的功能，原有结构仍承担学习导航和交付验收的功能。

## 验收流程

- `pnpm test`：包括 `src/content/course-editorial-narrative.test.ts`，检查 54 节中英文文章均包含独立、非列表式的正文叙事。
- `pnpm build`：验证 Markdown 渲染与打包。
- 已有章节连续性、Rust 示例、代码围栏、中英文对照、原始 ZIP 和变异测试仍然是强制门禁。

---

## English — Writing lessons as technical articles

A good tutorial is a connected explanation of **an engineering problem, a tempting but inadequate solution, the mechanism that changes the design, and evidence that the new solution works**.

Begin with concrete input and an observable failure instead of a list of language features. Lead the reader from an initial hypothesis through a small example and its limitations. Explain tradeoffs, especially where Java/Go intuition differs. End with replayable commands, edge cases, and independent acceptance criteria.

Headings should describe meaningful questions or decisions, not “Core concept 1/2/3.” Avoid repeating the same generic story across lessons. Preserve Rust code fences, source links, exercises, and published starter behavior in both languages. Expanded prose must be technically precise: a successful build is not proof of correct business behavior, a lifetime annotation does not extend an owned value's lifetime, and `String::len()` counts bytes.

**Second pass: argument before outline.** After scenario-led introductions, remove six-label worksheets from the reasoning body. The article should explain an actual incorrect implementation, the relevant compiler or domain mechanism, and an executable boundary test in connected paragraphs. Before each worked snippet, ask what the reader predicts; afterward, separate observed behavior from claims that the small example cannot prove. This pass expands all 54 bilingual reasoning sections and annotates eleven key code examples without changing the original Rust snippets or lab contracts.

**Capstone and independent-check articles.** For L05, write like a reproducible investigation of the released starter: capture the first compiler or behavioral failure, identify a discriminating input, repair the smallest actual defect, and verify that the public contract and original archive remain intact. Do not conflate compiler success with business correctness or reveal the reference implementation as the first step.

For L06, begin with an independently stated behavioral contract, reason through boundary cases, reject plausible wrong alternatives, and require a clean-room deliverable. The prose should explain *why* a test identifies a defect without simply giving away a complete solution. Preserve task lists, starter references, commands, progressive hints, and all existing acceptance tests. Each bilingual L05/L06 article now has a four-paragraph debugging narrative guarded by `src/content/course-lab-editorial-depth.test.ts`.

The automated editorial test checks for distinct narrative sections in all 54 Chinese and 54 English lessons. It supplements, never replaces, the existing code, continuity, translation, and build checks.
