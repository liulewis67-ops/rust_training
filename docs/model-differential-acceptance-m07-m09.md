# M07–M09：模型差分测试与变异检出率

本阶段的验收目标不是“有更多断言”，而是**通过独立模型验证一类输入规律，并通过能编译的错误实现检验测试是否有效**。这不是对所有 Rust 程序的正确性证明，也不是代码覆盖率。

## 可复现输入与参考模型

| 模块 | 固定种子 | 主生成轮数 | 独立契约 |
| --- | --- | ---: | --- |
| M07-L05 | `0x7AB1202610300007` | 448，分别验收两个解析器 | UTF-8 字符位置、首个分隔符、错误种类、trim 与规范标签 |
| M08-L05/L06 | `0xC0FF_EE08_2026_1030` | 每个属性 320 | 独立 `BTreeMap` 和 `u128/i128` 累加、重排/旋转、零字节与缺失行 |
| M09-L05 | `0xC0FF_EE09_2026_1030` | 384 | 独立符号表模型、首错优先级、字段及行列、CRLF、上下界 |
| M09-L06 | M09 种子派生 | 128 | 多层原因链、脱敏、Unicode/空白 request ID、CLI/API 对应关系 |

生成器仅使用标准库、确定性 xorshift64，不增加 Cargo 依赖；断言失败会输出种子、用例编号及输入。M08 随机数值保持在有界范围内；涉及极值的已有测试只检查每一步中间和仍在 `i64` 范围内的排列，以免错误地扩大溢出契约。

独立模型使用不同表示方式：M08 被测实现为 `HashMap`，模型采用有序映射和宽整数；M09 模型采用键符号表与词法分界。模型本身也可能有错误，因此不能以模型相等替代变异测试。

## 对抗式变异验收

单次只更改临时目录中一个源码位置。严格遵循：

1. 正确参考实现必须首先通过原有公开和独立测试。
2. 错误实现必须可以正常编译；编译失败不算“杀死”变异。
3. 一条**具名业务测试**必须失败。不能把没运行测试、意外编译错误和其他故障算作通过。
4. 恢复代码后，参考实现必须重新全部通过；原始发布 ZIP 字节不变。

新增变异包括：M07 的键值交换、只在一侧 trim；M08 的零字节被跳过、大小写服务被合并、空键被忽略、拒绝设备行消失；M09 的空白行误跳过、允许前导加号、重复空值分类错误、用 `u32` 解析本应支持 `u64` 的配置值。同时保留已有的错误传播链和 CLI/API 映射变异。

**变异检出率 = 当前明确枚举的、能够编译的变异中，被具名断言拒绝的比例。** 这既不代表 Rust 代码覆盖率，也不保证其他所有错误实现必然被识别。

## 验证命令

~~~sh
python3 scripts/verify-m07-parser-adversarial.py
cargo test --offline --manifest-path content/samples/m08-reference/Cargo.toml --test model_properties
cargo test --offline --manifest-path content/samples/m09-reference/Cargo.toml --test model_properties
python3 scripts/verify-m08-m09-adversarial-mutations.py

# 如需本地生成和 CI 同格式的 JSON 证据：
export MUTATION_REPORT_DIR=artifacts/mutation-report
python3 scripts/verify-m07-parser-adversarial.py
python3 scripts/verify-m08-m09-adversarial-mutations.py
python3 scripts/report-adversarial-mutation-score.py
~~~

PowerShell 对应环境变量写法为 `$env:MUTATION_REPORT_DIR = "artifacts/mutation-report"`。生成的 `m07.json`、`m08.json`、`m09.json` 和 `summary.json` 包含原始工程、种子、生成用例数量、错误变异、命中的验收用例和统计结果。Quality CI 将这些文件存入 `m07-m09-mutation-evidence` artifact，并在 job summary 里显示得分表。

## 教学边界

这套教师端验收不等于学生作业的自动评分。学生应能在不查看变异实现的情况下为自己的改动编写独立测试。后续若要引入随机用例自动收缩（shrinking）、任意属性空间或通用变异测试框架，需另行评估依赖与运行成本；当前版本专注离线、稳定、可审计。

---

## English — deterministic model tests and mutation evidence

This phase tests the actual published M07 ZIP and the real M08/M09 Cargo reference projects. It uses no external generator dependencies and does not alter student starter artifacts.

- **M07:** 448 generated inputs, two parser variants, seed `0x7AB1202610300007`. Compare first UTF-8 delimiter, error identity, Unicode trimming, and canonical output against a separately constructed oracle.
- **M08:** 320 inputs per property, seed `0xC0FF_EE08_2026_1030`. Use a sorted-map, wide-integer model to check grouping, sensor filtering, ordering invariants and event/row preservation.
- **M09:** 384 input configurations, seed `0xC0FF_EE09_2026_1030`, plus 128 safe-error cases. Check exact first-error precedence, numeric bounds, Unicode columns, private error sources and exact CLI/API public responses.

Each mutation must compile and fail a *named independent assertion*. Results, test names, reproducible seeds and per-module score are saved as JSON and archived by GitHub Actions. The score describes **only the selected compiling mutants**, not total code coverage, all possible faulty solutions, or a proof of correctness.

Run the commands above; on Windows PowerShell set `$env:MUTATION_REPORT_DIR = "artifacts/mutation-report"` before invoking the scripts. Every generated-case failure includes enough information to replay the fixed seed.
