# M23-L05 实验：定位一个真实瓶颈

## 实验目标

对固定的多窗口 actor 授权统计 workload，先确认输出合同，再用采样 profile 找热点，最后做一个局部改动并复测。目标候选是每个 event 对一组允许 actor ID 做线性扫描；正确改动可以构建一次 hash index 并跨窗口复用。实验不预先保证速度收益：要把 index 构建成本纳入同一端到端 workload，比较相同输入/输出，并保存原始结果。

这是一项课程实验模板。Windows 作者侧合同和本机 benchmark 不代替隔离 runner 的 profiling。R2/R3 的正式实验需要记录 commit/revision、Rust/Cargo、target、build flags、机器/OS、采样器、负载构造、warming、样本、原始 profile、Criterion 结果和 reset 结果。

## 学员操作顺序

1. 从 `m23-l05-bottleneck-lab` 干净快照开始，记录 `git rev-parse HEAD`、`rustc -Vv`、`cargo -V` 与 `cargo tree --locked`。先跑所有合同和 release build；保存 baseline 输出。
2. 固定工作负载为 8 个窗口 × 每窗 10,000 个 event、允许 actor 集合约 500 项；构造输入不进入计时区。先用 `cargo bench --bench bottleneck -- scan_baseline --save-baseline before` 测得 baseline。
3. 在隔离 R2/R3 runner 上运行公开指定的 CPU sampling profiler，保留原始 profile/火焰图。标明采样事件、窗口、权限、build flags 和工具版本。定位调用路径后再说明假设；火焰图样本宽度本身不等于精确 CPU 时间或分配字节数。
4. 一次只改索引查找热点。维持 API 行为、允许集合语义和总分数；重新运行全部正确性合同。用 `cargo bench --bench bottleneck -- --baseline before` 测整个 8 窗口 workload；将同次运行中 scan 与 indexed 的区间直接对照。不要只比较 search loop 而把 hash index 构建排除在计时外。
5. 对照前后 throughput 与置信区间/变异，保留原始 Criterion 目录。若差异在噪声内、结果错误或改动让端到端工作变慢，撤销/重测并记录；不能凭源码复杂度推断胜出。
6. 运行私有评测后恢复干净快照，确认工作区与初始锁文件、测试及 fixture 一致；记录 teardown/runner 清理结果。

## 公开合同

- `score_windows_scan` 和 `score_windows_indexed` 对相同窗口/允许 actor 集合返回逐窗一致分数。
- 允许 actor ID 刻意未排序，不能把 `binary_search` 用在未经排序的输入上。
- 空窗口、重复允许 ID 和无命中 actor 不改变语义；每个 Event 只计一次。
- baseline profile 与 after benchmark 必须使用相同 release fixture、窗口、Rust target 和 runner；index 创建成本包含在被比较的 indexed pipeline 中。
- 正确性不依赖性能阈值。共享 runner 的单次结果不能作为成绩门槛。

## 私有受控验收与重置

验收使用未公开的 actor/event 种子变体，但保持上述行数/集合大小级别。公共检查通过后，在固定 R2/R3 release runner 上运行 before/after、profile 和功能回归；私有 evaluator 核对输出等价、报告 provenance、原始数据、噪声边界、失败/回退判断、commit snapshot 和 reset 结果。评分不以某个固定微秒阈值代替推理质量。

重置时丢弃练习分支并重新 checkout 起始 commit，重新生成锁定依赖、跑合同与基准 smoke，删除本次私有数据和临时 profile。若 runner 或 profiler 中断，标记实验基础设施失败并重试；不把平台问题算成学员技能失败。

## 来源

- [Rust Performance Book：Profiling](https://nnethercote.github.io/perf-book/profiling.html)：用 profile 识别值得调查的调用路径及工具平台边界。
- [Brendan Gregg：CPU Flame Graphs](https://www.brendangregg.com/FlameGraphs/cpuflamegraphs.html)：阅读 sampled stack 的宽度与调用栈。
- [Criterion 0.8.2：BenchmarkGroup](https://docs.rs/criterion/0.8.2/criterion/struct.BenchmarkGroup.html)：固定组 workload、预热、样本、测量时间和 throughput。
