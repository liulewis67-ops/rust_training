# M23-L03：吞吐、尾延迟、并发和容量

## 学完后

- 同时报告 offered/completed throughput、成功与失败数、p50/p95/p99、并发和 pending work。
- 解释到达率、服务率、排队时间如何共同影响尾延迟，辨认接近容量时的饱和迹象。
- 设计开放式到达负载或固定并发负载，说明负载模型会隐藏或暴露什么。
- 选择容量余量与过载处置，而不是把压测最大吞吐当作安全容量。

## 先把分母写清楚

吞吐是一个时间窗口里完成多少有用工作。报告完成请求数/窗口长度，也记录 offered 请求、错误、超时和仍在途请求。只按成功结果算 throughput 会掩盖失败；只记录 completed latency 会让仍在排队的请求从尾部消失。报告窗口结束时的 pending 数，避免把未完成工作误当成零延迟或不存在。

Latency 至少要定义起点和终点。端到端延迟从请求进入系统开始，到结果完成为止，包含排队、执行和必要的响应阶段。只计 `started_at..completed_at` 会丢掉排队等待时间。p95/p99 要说明样本集合、分位数算法、窗口与空样本处理；平均值不能替代尾部分布。若有超时/取消，将其单独计数，且保留其停留时间或删失状态。

## 并发、队列和容量

Little's Law 的稳定系统近似 `L = λW`：平均在系统中的工作量等于吞吐率乘以平均停留时间。它帮助检查数量级和排队变化，不表示可以在非稳定、持续过载系统中用一个点估算容量。把 `λ`（到达率）逐步推近服务能力时，队列会吸收短暂波动；接近饱和后，少量额外到达就可能显著拉长等待时间，p95/p99 先恶化，而平均吞吐短时间内仍看似平稳。

闭环 fixed-concurrency 压测器在响应变慢后会自动降低新请求到达率，可能让过载看起来比实际温和。开放式到达率可以维持目标 offered load，但必须限制生成器资源，并显式记录无法按时发出的请求，避免 coordinated omission。两种方式回答不同问题，应标注 load model、目标速率、实际发出速率、并发/连接池限制、窗口和资源边界。

可用容量不是一轮压测的峰值吞吐。先定义 SLO（例如 p95、错误率与 pending 上限），在目标负载及合理峰值下重复观察，再留出部署差异、突发和后台任务的余量。容量报告应同时给出完成率、尾延迟、错误/超时、在途/排队与资源利用率。若为了接受更多负载而让队列无限增长，系统只是把过载延迟化。

## 练习 crate 与测量边界

公开 starter 对请求时间线生成摘要，端到端 p95 有一处待修复错误：它从服务开始时刻计时，漏掉进入系统后的排队时间。合同测试同时核对 offered/completed/pending、完成 throughput、p95 和峰值执行并发。第三题要求补一条回归测试，证明窗口结束时尚未完成的请求不会被算作完成，也不会伪造更好的尾延迟。

小型 crate 只验证统计摘要合同。真实服务的 R2/R3 试验需要固定到达模型和数据、负载生成器余量、目标机器、warming、窗口和 teardown；它还需要观察 CPU、内存、连接池/队列深度、错误率与 p95/p99。只在本机循环调用纯函数，不能证明线上容量或并发安全。

## 分层提示

1. 如果 1,000 req/s offered、900 req/s completed、100 个请求 pending，应该如何报告吞吐和未完成量？
2. 一个请求先等 70 ms 才获得 worker，再运行 30 ms。端到端 latency 是多少？
3. 每批请求仍维持 500 req/s completed，但 p95 从 40 ms 上升到 900 ms、pending 持续增长。这表示系统处在什么状态？
4. fixed-concurrency 压测器的响应时间变长后，offered rate 会发生什么变化？
5. 为什么不能用短时最高 completed throughput 直接设定生产容量？
6. 滑动窗口末尾的未完成请求，是否应从 latency 百分位样本中当作 0 ms？报告中还需列什么？

## 来源

- [The Rust Performance Book：Benchmarking](https://nnethercote.github.io/perf-book/benchmarking.html)：workload 可重复性和受控性能测量。
- [Criterion 0.8.2：Throughput](https://docs.rs/criterion/0.8.2/criterion/enum.Throughput.html)：throughput 分母及元素/字节工作量描述。
- [Criterion 0.8.2：BenchmarkGroup](https://docs.rs/criterion/0.8.2/criterion/struct.BenchmarkGroup.html)：成组配置样本、预热、测量时间和 throughput。
- [John D. C. Little, A Proof for the Queuing Formula: L = λW](https://pubsonline.informs.org/doi/fpi/10.1287/opre.9.3.383)：原始排队关系；本文只将稳定系统下的平均量关系用于数量级检查，不把它外推到持续过载。
- 开放式与闭环负载模型对过载可见性的教学说明为原创内容；课程要求用固定窗口的 offered/completed/pending counts 作合同检查。
