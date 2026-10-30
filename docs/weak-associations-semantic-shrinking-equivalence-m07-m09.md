# M07–M09：弱关联变异、数值/语法收缩与等价变异审查

本阶段目标不是单纯提高“杀死率”，而是让测试能够解释**为何检出或没有检出某种错误实现**，对失败数据作更有意义的缩减，并把可能等价的程序变更放入单独的审查流程。

## 1. 面向覆盖矩阵的新增错误实现

原有每条独立测试的“命中数”与每个变异的“被哪些测试识别”可以从 `matrix.csv` / `summary.json` 提取。本轮新增五种**可编译的真实业务缺陷**，强化对边界错误和薄弱关联的验证：

| 模块 | 错误实现 | 检测契约 |
| --- | --- | --- |
| M07-L05 | Value 只做左侧 trim，末尾空白被泄漏到结果 | Unicode 生成式解析模型与规范化输出 |
| M08-L05 | 单条服务日志的 byte 值错误地截断到 1024 | 带极值及随机生成记录的独立聚合模型 |
| M08-L06 | 把合法负传感器值当作 0 累计 | 有符号读数与独立汇总模型 |
| M09-L05 | EOF 缺少字段错误的行号少 1 | 空缺字段的精确位置契约 |
| M09-L06 | ProfileNotFound 错用 HTTP 409，而不是 404 | 全部领域错误的 API 映射契约 |

由原来的 31 种选定错误实现扩展为 **36 种**，其中不包含明确等价的改写。报告另列每条测试的命中数、同类检测签名数量及“最多只识别一种选定变异”的审查清单。**命中数低不是断定测试无用，只说明在当前样本中缺少反例。**

## 2. 反例的进一步缩减

- **M07:** 继续保留 Unicode 字符级删除和稳定复现的首分隔符模型，不改变发布 ZIP。
- **M08:** 先删除事件/读数，随后将服务 byte 值向 `0/1/2/1024/1025` 与数值折半缩小；对 `i64` 传感器值尝试 `0`、`signum` 和折半，使用 `unsigned_abs` 避免 `i64::MIN` 的取绝对值溢出。
- **M09:** 先删除完整配置行，尝试 CRLF→LF，进一步将十进制值缩减到有代表性的数值（`0/1/2/9/255/256/4294967295/4294967296`），最后进行 Unicode 字符删除。每一步必须仍然产生相同类别的**模型/真实实现差异**，而不只是产生任意解析错误。

以上算法是**有方向、有限步骤的语义简化 + 1-minimal 字符/记录删除**；数值简化并不保证达到数学上的最小数字或全局最短文本。产生的 witness 包括 seed、case、原始数据和实际缩小后数据，可用于教师诊断。

## 3. 等价变异三分法

新增 `scripts/verify-equivalent-mutation-triage.py` 在真实的 M08/M09 参考 Cargo 工程中验证不同的改写，并单独输出 `equivalence-triage.json`。

**一、可编译且已逐项审查语义等价：** 五种改写分别涉及无副作用默认值的 `or_insert`→`or_insert_with`、`+=`→显式加法、bool 与 true 的比较、`str::is_empty`→长度为 0、对同一 UTF-8 字节序列使用不同迭代方式。这些改写需有具体语义依据和完整测试通过记录，**不计入 36 种预期会被杀死的变异**。

**二、可编译但确实不等价：** `line.is_empty()` 改为 `line.trim().is_empty()`，对于全空格行改变解析规则。该对照必须由真实业务断言识别，不能被误分类为等价变异。

**三、测试全部通过但缺乏语义证明：** 标记为 *survived / requires review*，不得默认为等价。当前验证器对未在显式审查清单内的候选会直接失败，避免用“测试没发现”冒充等价证明。

需要特别区分：**通过完整测试并不能数学证明程序等价**。人工语义分析支撑的是当前操作及约束下的等价判断。`equivalence-triage.json` 保存依据和实测结果以供未来复核。

## 4. 运行与交付

~~~sh
export MUTATION_REPORT_DIR=artifacts/mutation-report
python3 scripts/verify-m07-parser-adversarial.py
python3 scripts/verify-m08-m09-adversarial-mutations.py
python3 scripts/verify-equivalent-mutation-triage.py
python3 scripts/test-adversarial-mutation-report.py
python3 scripts/report-adversarial-mutation-score.py
~~~

Windows PowerShell：`$env:MUTATION_REPORT_DIR = "artifacts/mutation-report"`。

Quality CI 需要验证：36 种指定错误均能编译且由具名测试检出；五个经审查的语义等价改写通过完整回归且不加入分母；非等价对照确实失败；伪造分类、缺失证据、缩减反例缺失均不能通过报告校验。原始学生 starter、发布 ZIP 及课程 Cargo 依赖不受影响。

---

## English — Weak associations, semantic shrinking and equivalence triage

This phase adds five targeted, compiling **non-equivalent faults** (value trailing whitespace, capped service bytes, discarded negative sensor values, wrong EOF line and wrong 404/409 mapping). Each is checked by a named existing independent contract. The matrix additionally publishes per-test detection counts and weak-association candidates, without claiming that a low count proves a test is ineffective.

M08 now applies bounded numeric simplification after event/reading deletion. M09 uses grammar-aware line removal, CRLF normalization, representative decimal substitutions, and final Unicode-scalar deletion. Every accepted change must preserve the differential error category. These are **guided reductions**, not globally minimal proofs.

A separate equivalence review runs five explicit rewrites with semantic explanations and full Cargo regression tests: pure `or_insert_with` default, `+=` rewriting, boolean identity, empty-string length, and UTF-8 byte iteration. One deceptive but **non-equivalent** whitespace-line mutation must be killed. Missing review, absent triage files or forged equivalence classifications fail CI. Reviewed-equivalent candidates are reported separately and **excluded from the selected faulty-mutant denominator**.

The CI archive contains the detection matrix, minimized witnesses, score and `equivalence-triage.json`. Full passing tests alone never justify declaring an unknown survivor semantically equivalent.
