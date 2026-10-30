# M07–M09 对抗式实验验收：可编译错误实现的识别能力

目标不是增加断言行数，而是证明测试可以区分**正确实现**与**可以编译、局部样例也看似正确的错误实现**。验收顺序必须为：真实原始工程可复现 → 正确实现通过 → 注入单个变异 → 仍能编译 → **指定业务断言失败** → 还原后全部通过。

## M07-L05：发布 ZIP 是唯一学生起点

使用原始 `content/releases/m07-l05-starter.zip`，校验 ZIP 安全结构和原始哈希清单，在临时目录解压，确认未修复时 `ColonParser` 的业务断言失败。仅修正 `:` 分隔符后，额外注入六组外部验收：首分隔符、末尾分隔符反例、Unicode / trim、错误种类与分隔符身份、空键值优先级、`render_label` 的规范形式。

| 可编译伪正确实现 | 独立反例 |
| --- | --- |
| ColonParser 仍按 `=` 解析 | `x=y` 必须返回 `MissingDelimiter(':')` |
| 使用 `rsplit_once` | `中文:值:two:三` 只能在首个冒号处分割 |
| 不 trim value | 只有 Unicode 空格的 value 必须是 `EmptyValue` |
| key 只 trim_start | `"  key \t:ok"` 不能保留结尾空白 |
| 错误中的 delimiter 固定为 `=` | ColonParser 无分隔符错误必须保留 `':'` |
| 空键误判为空值 | `"  :  "` 首个失败必须是 `EmptyKey` |
| 规范标签用冒号 | 两种 parser 的 `render_label` 必须输出 `key=value` |

脚本 `scripts/verify-m07-parser-adversarial.py` 会分别执行 7 个编译通过的变异并要求具名测试失败；不改写 ZIP，也不通过修改源码里原始测试来伪造通过。

## M08：组合顺序、聚合及所有权

`content/samples/m08-reference/tests/adversarial_contracts.rs` 是独立于库内部 `#[cfg(test)]` 的集成测试。对同一批服务事件做旋转和倒序，持续验证大小写区分、显式排序、重复事件累积、`u64::MAX` 极值、零字节仍计数，且借用服务名指针指向原始 String；将空服务名与单空格服务名视为两个不同键。

传感器实验同时组合 `Some(0)`、`None`、拒绝记录和 `i64::MIN/MAX` 抵消，验证拒绝或缺失的设备仍留行、仅有效有值记录计数。**溢出边界：** 原始任务仅保证结果可用 `i64` 表示，参考实现按读取顺序以 `i64` 累加；新的重排验收只选择每一步中间和仍在 `i64` 范围内的顺序，避免在未明确定义的中间溢出上强行要求结果。

## M09：首次错误与多层诊断来源

`content/samples/m09-reference/tests/adversarial_contracts.rs` 将重复键 + 非法值 + 后续未知字段、CRLF、Unicode 列号、十进制上下界与额外等号组合，断言**最早出现的失败**及精确的 `ConfigError` 类型、字段、行、列，并确保任何公开错误字符串不回显非法输入。

错误呈现测试构造 `HistoryError → io::Error → 自定义上下文 → 私有底层原因`。检验领域错误的 `source()` 仍可追踪底层私有原因，CLI/API 公共响应只使用静态安全消息，状态码 / 错误码 / retryable / 退出码精确匹配，多次转换不会消耗错误，空、Unicode、空格和换行 `request_id` 原样保留。**不要把 `io::Error::source()` 必须逐层暴露每个自定义包装器的内部细节当作课程契约。**

## 运行及验收

```sh
python3 scripts/verify-m07-parser-adversarial.py
cargo test --offline --manifest-path content/samples/m08-reference/Cargo.toml
cargo test --offline --manifest-path content/samples/m09-reference/Cargo.toml
python3 scripts/verify-m08-m09-adversarial-mutations.py
node scripts/verify-m08-labs.mjs
node scripts/verify-m09-labs.mjs
```

- M07：原始 ZIP 的修复后代码通过全部公开 + 独立测试，7 个编译成功的变异分别因指定断言失败而被拒绝。
- M08/M09：两份参考工程的独立集成测试通过，且变异脚本逐个检验错误实现无法通过指定测试；starter 的预设业务失败仍保留，不因为测试变多就把新的意外失败计算进去。
- 测试检出能力不等于所有可能的错误都被穷尽。新增变异应明确记录修改位置、错误语义、期望失败的测试名称，并在还原后复跑整个参考套件。

## 独立交付边界

CI 的参考工程测试不是学生提交的自动评分。学生应在原始 ZIP 或 starter 的独立副本里完成实现，使用相同的外部契约表证明自己的代码，在报告中分开描述编译错误、行为断言失败、断言覆盖盲点与未定义的输入边界。中英文正文的补充链接用于指导实践，不把教师端对抗脚本包装成在线测评服务。
