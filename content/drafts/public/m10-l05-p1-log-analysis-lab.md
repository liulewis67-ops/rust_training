# M10-L05 实验：交付 P1 日志分析 CLI

## 实验目标

将课程中构建的 Rust 模块、错误处理、Cargo workspace、测试、CLI 流程、依赖锁和文档串成一项可复现交付。完成后你应能：

- 在独立 library 中逐行解析日志，并报告可定位的格式错误；
- 通过文件或标准输入读取，按级别、时间范围和关键词过滤；
- 只在完整成功后输出 text 或 JSON 汇总，保持 stdout/stderr 和退出码稳定；
- 以流式处理聚合记录，在任务指定的 R2 数据规模和内存预算内运行；
- 使用独立起始 ZIP 重置，按 README 在干净工作区复现构建和测试。

这是一次 P1 项目实验，不是额外的短练习。P1.1–P1.4 四张阶段任务卡共用同一份项目源码；课程平台正式开放后，每张卡应有独立快照、评测版本和提交结果。当前作者侧 ZIP 和本地运行只校验内容与参考实现，不创建正式提交快照。

## 项目契约

每条非空输入行格式如下：

~~~text
timestamp_ms|LEVEL|message
~~~

- timestamp_ms 是 Unix epoch 毫秒的无符号整数。
- LEVEL 精确匹配 ERROR、WARN、INFO 或 DEBUG。
- message 是第二个竖线之后的原文，可为空、可包含更多竖线，也可包含 Unicode。
- 完全空行跳过；仅含空格的行不是空行，应按格式错误报告。
- 第一条坏行使整次运行失败。错误包含 1-based 行号和错误类别；失败时 stdout 不包含部分汇总。
- --level 可重复出现；未提供时包含全部级别。--from-ms 为含边界的下限，--until-ms 为不含边界的上限。--contains 对 message 做区分大小写的子串匹配。多个条件按 AND 组合。
- 输入路径通过 --input 指定。未指定或路径为 - 时读取 stdin；否则从文件读取。
- 默认 text 输出为固定字段顺序；--format json 输出固定 JSON 字段顺序。正常报告只写 stdout，错误只写 stderr。
- --help 以退出码 0 写 usage 到 stdout。参数错误退出码 2；文件、读取或日志解析失败退出码 1。

起始项目中的 public.log 是小规模公开数据。expected.txt 与 expected.json 是不带筛选条件的参考结果。不得用公开样本代替 R2 提供的独立边界集或资源测量数据。

## 四个 P1 阶段卡

### P1.1 解析核心

维护 log-core library 和公开解析错误类型。检查 Unicode、空行、分隔符出现在 message 内、缺字段、时间戳溢出、未知级别与坏行行号。解析测试不应依赖 CLI；CLI 也不应重复实现解析。

### P1.2 命令行交互

实现 --help、--input、可重复 --level、两个时间边界、--contains 和 --format。分别验证有效/无效参数、文件和 stdin。验证成功输出只到 stdout；错误只到 stderr；参数错误和输入错误返回不同的契约退出码。

### P1.3 稳定处理

使用 BufRead 逐行处理，只保留过滤器和固定大小的聚合计数，不把所有记录或整份输入复制到内存。正确性 suite 覆盖过滤组合、空输入和边界；用 R2 固定工具链、数据规模、隔离环境和内存预算跑资源验收。记录输入字节数、记录数、耗时、峰值内存和评测器版本。若 R2 环境、预算或数据不可用，此项标为未验收，不得用本机小样本速度代替。

### P1.4 可复现交付

完成 README、公开样本、预期输出、Cargo.lock、格式/测试/Clippy/API 文档命令与示例。清洁解压后执行 locked/offline 命令，不手改 lockfile。一次审查错误实现并保存契约反馈；记录 ZIP 与文件清单哈希。

## 工作步骤

1. 复制并解压公开起始 ZIP 到全新目录；按 starter-manifest.json 校验每个项目文件的 SHA-256。将该副本保留为起始快照。
2. 运行 cargo fmt --all -- --check 和 cargo test --workspace --locked --offline。记录测试目标、通过数、预期失败和失败断言；基线必须能编译，不能用编译失败冒充行为回归。
3. 修复 P1.1，先使 library 解析测试通过，再通过 CLI 调用同一个 library。至少新增一条回归测试复现你修复的错误。
4. 依次完成 P1.2 的参数/进程契约、P1.3 的流式过滤和聚合、P1.4 的文档与干净构建。阶段卡之间共享源代码，但每张卡的任务提交与状态证据彼此独立。
5. 每项检查后运行 fmt、workspace check、测试、严格 Clippy 和 API 文档命令；更新 public.log 的预期输出或新增边界样本时同步更新测试。
6. 在 R2 固定环境运行资源数据集。确保评测器能区分用户程序资源失败与平台故障；保留受控输入快照、版本哈希、工具链、隔离环境版本、资源上限和结果。
7. 试验至少一个错误变体，例如：将 splitn(3, '|') 改成无界 split 后只使用前几个字段；把 IO/解析错误映射成成功空汇总；先输出部分结果再遇到坏行；将所有输入先 collect 到 Vec。记录相应行为测试或 R2 检查如何检出它。
8. 用原始 ZIP 重新解压，重新校验 manifest 并重放基线；教师参考只用于作者验收，不得放入 public 目录。

## 参考命令

~~~text
cargo fmt --all -- --check
cargo check --workspace --locked --offline
cargo test --workspace --locked --offline
cargo clippy --workspace --all-targets --locked --offline -- -D warnings
cargo doc --workspace --no-deps --locked --offline
cargo run -p log-cli --locked --offline -- --input fixtures/public.log --format json
~~~

示例命令的期望输出与 fixtures/expected.json 相同。输入错误时输出应为空，错误诊断只出现在 stderr。

## 分层提示

1. **解析器**：按两个分隔符拆成三个字段；message 中余下的分隔符属于消息本身。
2. **CLI**：将参数解析、文件打开、日志业务与结果渲染分开；不要为了测试二进制而把全部逻辑塞入 main。
3. **错误边界**：库返回可匹配错误；CLI 为人写 stderr 和状态码；stdout 保持可管道消费。
4. **流式处理**：聚合状态大小应随级别种类增长，而不是随日志条数增长；输入读取、过滤、聚合须在单条记录生命周期内完成。
5. **测量**：先固定工作负载和内存预算再运行，记录工具链、隔离版本和负载哈希；没有 R2 数据只能报告功能预检。
6. **重置**：从 ZIP 重新解压，不在修复副本里覆盖唯一基线；核验 manifest 后再开始新一轮。

## 重置与证据清单

每轮实验至少保存题目版本、ZIP SHA-256、starter manifest、输入数据哈希、源代码提交快照、工具链和目标环境版本、公开/受控评测器版本、命令、退出码、stdout/stderr、测试报告、R2 资源数据以及学习者辅助程度。平台故障需单独分类，不能作为代码失败记录。Windows 作者侧解压复测只证明包体可复现，不替代隔离执行、重置服务或学习者独立试做。

## 来源与原创声明

P1 内容规格沿用本项目《课程设计》中的日志分析 CLI：文件/stdin、级别/时间/关键词过滤、text/JSON 输出、四阶段交付和内存预算。日志行格式、字段名、公开样本和参考代码是本项目为课程新创作的契约。
