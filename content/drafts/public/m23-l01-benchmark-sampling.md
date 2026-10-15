# M23-L01：基准、采样、火焰图与测量误差

## 学完后

- 把性能问题转成可重复的问题：输入是什么、测哪个指标、与哪个 baseline 比、差异多大才值得处理。
- 运行 release/bench profile 的多轮测量，保留预热、原始样本和机器/构建元数据。
- 用采样 profile 找出值得检查的热点，并解释它能支持什么判断、不能证明什么。

## 先问测量问题

先固定 workload 和可观察结果。选接近实际流量的输入规模、分布和操作路径；微基准适合隔离小段计算，但不能代替真实负载。确定 latency、throughput、CPU samples 或 allocation 等与问题相符的指标。报告写明用户可感知的预算与比较阈值；不要看到某个函数占比高就默认它值得改。

比较两个版本时，应控制源码以外的变化：同一台机器、工具链、依赖锁、编译 profile、feature flags、目标平台、输入数据、环境变量和后台负载。保留 baseline 与 candidate 的多轮原始值及执行顺序；避免一次跑完 A 再跑 B，让温度、频率或邻居任务只偏向其中一方。遇到明显机器噪声，重做整组测量并说明重跑理由，不只挑最好的一次。

## 基准不是 `Instant::now()` 的一次差值

`cargo bench` 使用 `bench` profile；stable Rust 的内置 `#[bench]` 仍不是稳定接口，可选用 Criterion 等 stable harness。用 `std::hint::black_box` 阻止一些不现实的常量折叠或未使用结果消除，但它是 best-effort 优化提示，不会自动修复错误 workload，也不保证真实应用行为。创建输入、读取文件、打印日志和初始化连接是否应计入时间，取决于要回答的问题；把它们排除时要放在测量区间外并说明。

练习 crate 的摘要合同把样本排序后报告 `min`、`median`、`p95` 和 `mean`。`median` 对偶数样本取中间两项的整数下取整均值；`p95` 用 nearest-rank 定义：排序后 1-based 的第 `ceil(0.95*n)` 项。样本数太少时，p95 只能作粗略描述；任何统计摘要都不能替代原始样本、单位和采样方法。不要把 percentile 本身做算术平均来合并分布。

## 预热、重复与测量误差

把预热操作和计时样本分开。预热可触发代码路径、分配器或缓存行为，但长生命周期服务、冷启动和 cache-cold 工作负载可能需要分别测；不能把预热描述成总能消除噪声。保存每次测量值，不要把每次内部迭代误当成独立机器样本。报告样本数、预热轮数、每样本迭代、开始时间、输入 hash、profile、编译器、依赖锁、CPU/OS、温控或后台负载限制及工具版本。

先检查分布和异常值，再决定用中位数、分位数、均值/标准差或工具给出的区间。若比较差异与跨轮波动处在同一量级，应报告“证据不足”，增加样本或改进控制变量。不要仅凭一轮 p95 改善宣布优化有效；同一运行内的请求可能相关，也不等于独立实验。

## 采样与火焰图

基准测“发生了多久/多少”；采样 profiler 周期性记录执行时的栈，用于找值得进一步检查的路径。火焰图把栈折叠显示：横向宽度代表采到的样本占比，纵向表示调用栈层次。它不是精确时间账本，宽块不自动证明它是根因，也不能显示未被采到的工作；采样间隔、符号/调试信息、native library 和 profiler 本身都影响结果。

记录采样工具、采样时间、profile artifact hash、采样频率/事件、是否有 source line symbols，以及 flame graph 生成命令。查看路径时从业务入口顺着 caller/callee 查证，再选一个可控变量做基准回归。火焰图告诉你先看哪里，不告诉你改动的因果效果；改后仍需要同 workload 的 A/B 基准与正确性检查。

`perf` 主要适用于 Linux；macOS Instruments、Windows VTune 或跨平台采样工具能否使用取决于系统和授权。Rust Performance Book 说明 release profile 源码行符号、frame pointer 和工具支持各有条件。没有适配 profiler 时不要伪造火焰图；保存当前平台限制并换用经批准的采样路径。M23 正式结论须在 R2/R3 固定环境复现，本机结果只说明本机。

## 结果记录示例

```text
question: candidate 在 64 KiB JSON 输入上的解析 p95 是否改善至少 5%？
environment: rustc 1.95.0; x86_64-pc-windows-msvc; release; CPU/OS/build flags/hash...
workload: fixture sha256=...; parser result checksum=...
protocol: 3 warmup rounds; 20 paired measured batches/version; 1000 iterations/batch; recorded process/batch boundaries; paired AB/BA order
raw ns/batch: baseline=[...]; candidate=[...]
summary: nearest-rank p95 and median per version; interval/method; discarded samples and reason
profile: tool/version/event/duration/artifact hash, or unsupported with reason
conclusion: effect vs threshold; uncertainty; next check; rollback/repro command
```

这是报告字段示例，不是预设通过数字。若函数执行时间短于计时器稳定分辨率或 profile 采样窗口不足，先调整批量/持续时间并校验结果，再解释比例。

## 分层提示

1. 同一版本两次输出分别是 10 ms 与 13 ms，candidate 为 11 ms。现有数据能否证明回归？还缺什么？
2. 一张 flame graph 中 parser 占 70% 样本，能否得出“parser 是 70% 总 wall time 且重写后能快 70%”？指出至少两个缺失前提。
3. 为什么 benchmark 输入和输出都可能要经过 `black_box`？它的保证边界是什么？
4. 把机器、feature flags 或 release profile 同时换掉后，能否把差异归因于一处代码修改？
5. 离群值是机器抖动还是有效真实慢请求？报告如何保留这种不确定性？

## 来源

- [The Cargo Book：cargo bench](https://doc.rust-lang.org/cargo/commands/cargo-bench.html)：默认 bench profile、stable/nightly harness 的边界。
- [Rust `std::hint::black_box`](https://doc.rust-lang.org/std/hint/fn.black_box.html)：优化提示的用途与 best-effort 限制。
- [The Rust Performance Book：Benchmarking](https://nnethercote.github.io/perf-book/benchmarking.html)：workload、比较方案与指标波动。
- [The Rust Performance Book：Profiling](https://nnethercote.github.io/perf-book/profiling.html)：profiler 选择、release 调试信息及 frame pointer。
- [Brendan Gregg：CPU Flame Graphs](https://www.brendangregg.com/FlameGraphs/cpuflamegraphs.html)：CPU 火焰图中的 stack frame 宽度按采样数表示，而不是独立的精确 wall-time 计时。
