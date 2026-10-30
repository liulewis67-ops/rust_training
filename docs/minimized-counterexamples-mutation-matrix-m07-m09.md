# M07–M09：失败用例最小化与变异覆盖矩阵

本阶段把“固定种子模型差分 + 精选错误变异检出率”升级为可追溯的**反例与覆盖证据**。完整流程为：验证原始/参考实现通过 → 在临时副本中注入一个可编译错误实现 → 运行全部独立契约 → 保存每条测试的通过/失败状态 → 对生成式模型发现的差异缩小输入 → 校验报告并归档。此流程始终不修改原始发布 ZIP 或学生 starter。

## 一、最小化的是具体失败，不是随机输入

| 模块 | 输入单位 | 最小化依据 | 反例重现信息 |
| --- | --- | --- | --- |
| M07-L05 | Unicode scalar 字符 | 反复删除一个字符，只保留能继续复现解析结果或规范标签差异的输入 | 固定种子、生成轮次、分隔符、原始输入和缩小后输入 |
| M08-L05/L06 | 单条服务事件或传感器读数 | 逐条删除记录，并每次重新与独立 `BTreeMap` 模型比较 | 固定种子、轮次、原始向量、缩小后向量、独立模型与实际输出 |
| M09-L05 | Unicode scalar 字符 | 逐字符删除；每一步必须仍然使配置符号表模型与实际解析器不一致 | 固定种子、轮次、原始配置、缩小后配置及两种结果 |

**重要限制：** 最终输入仅保证“删除任意单个字符/记录都无法保持同一差异”的 **1-minimal（单元素删除极小）**，不是全局最短反例，也不优化数字或字符值。静态契约直接拒绝的变异不一定产生最小化反例；只有生成式差分测试触发的失败才记录 `MINIMIZED_COUNTEREXAMPLE`。这样可避免将普通报错误称作 shrinker 的结果。

## 二、完整的测试 × 错误变异矩阵

- **M07：** 原始 ZIP 中独立注入的 7 项契约，对 10 个可编译变异分别记录成功与失败。
- **M08：** 4 项对抗集成测试 + 2 项模型属性测试，对 10 个变异运行**完整**独立测试集合。
- **M09：** 4 项对抗集成测试 + 3 项模型属性测试，对 11 个变异运行**完整**独立测试集合。

矩阵的每个单元格表示：对某个编译成功的变异，某条独立测试是否确实执行并失败；不是推断出来的命中，也不能使用编译报错充数。

**反作弊验收：** 20 个测试名称、31 个变异名称、每个变异的预期目标测试都在报告校验器中固定。测试没被发现、测试目录被替换、变异被删减或重命名、目标测试未失败、缩小后的反例缺失，都会使 CI 失败。额外的负向自测专门注入伪造证据，证明校验器会拒绝它们。

## 三、证据文件

在 GitHub Actions → Quality → 对应运行的 `m07-m09-mutation-evidence` 工件中：

| 文件 | 作用 |
| --- | --- |
| `m07.json` / `m08.json` / `m09.json` | 每个模块完整的独立测试目录、变异目标、全部命中测试与可用的缩小后反例；M07 额外保存原始 ZIP SHA-256 |
| `summary.json` | 跨模块变异统计、精确测试目录与可机器读取的布尔矩阵 |
| `matrix.csv` | 每行一条错误变异、每列一条独立测试，值 `1` 代表实际检测到该变异 |
| `matrix.md` | 以 `T1`、`T2` 等列别名展示矩阵，并列出完整测试名称；同时发布到 Actions Job Summary |

`31/31` 仅表示**当前枚举的 31 个、能编译的错误变异**都被至少一条独立测试拒绝；并非程序全域正确性、覆盖率或一般性变异测试工具的评分。没有命中当前变异的测试也不等同于无用，它可能覆盖本批变异未涉及的边界。

## 四、运行方式

~~~sh
# 直接验证每一轮完整测试与最小化机制。
python3 scripts/verify-m07-parser-adversarial.py
python3 scripts/verify-m08-m09-adversarial-mutations.py

# 本地生成与 CI 相同的 JSON、CSV 和 Markdown 工件。
export MUTATION_REPORT_DIR=artifacts/mutation-report
python3 scripts/verify-m07-parser-adversarial.py
python3 scripts/verify-m08-m09-adversarial-mutations.py
python3 scripts/test-adversarial-mutation-report.py
python3 scripts/report-adversarial-mutation-score.py
~~~

Windows PowerShell 使用 `$env:MUTATION_REPORT_DIR = "artifacts/mutation-report"`。

## 五、课程教学迁移

要求学生回答三个问题：出现的是哪种业务规则违反？为什么改变分隔符/排序/错误传播链的实现仍可通过编译？如何用最小反例说明行为差异？只有在明确测试对象的错误语义后，才应给出修复方案。对照 Java/Go 单元测试也一样：测试数量不等于检错能力；应解释每条测试区分了哪些错误实现。

---

## English — minimized witnesses and a full test × mutation matrix

This stage turns seeded model testing into **auditable, full-suite mutation evidence**. Every compiling mutation is tested against *every* independent contract in its module, not only its designated target. A test counts as a detector only when it actually executes and fails.

Generated differential failures receive a `MINIMIZED_COUNTEREXAMPLE`: M07 and M09 remove Unicode scalar characters, while M08 removes whole event/reading records. Each removal is retained only when it preserves the same oracle discrepancy. The result is **1-minimal for single-element deletion**, not a globally shortest counterexample. Fixed, non-generated assertion failures are not mislabeled as minimized witnesses.

The Quality workflow publishes `m07.json`, `m08.json`, `m09.json`, `summary.json`, `matrix.csv`, and `matrix.md`. The matrix records outcomes for 7 tests × 10 mutants in M07, 6 tests × 10 mutants in M08, and 7 tests × 11 mutants in M09. The reporter pins the exact 20 test identities, all 31 selected mutant identities, and their intended assertion mapping; negative self-tests verify that missing, substituted, or invented evidence fails CI.

The published ZIP and student starter projects remain unchanged. There are no new external Rust dependencies. Run the shell commands above, or set `$env:MUTATION_REPORT_DIR` in PowerShell. Remember that **selected-mutant sensitivity is not general coverage or a correctness proof**.
