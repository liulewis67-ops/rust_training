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

The automated editorial test checks for distinct narrative sections in all 54 Chinese and 54 English lessons. It supplements, never replaces, the existing code, continuity, translation, and build checks.
