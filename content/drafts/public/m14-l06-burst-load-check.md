# M14-L06 独立检查：高峰负载下不无界排队

## 作答要求

在不查看答案的条件下完成以下陌生场景。提交资源预算、事件轨迹、过载决策和一项可运行的失败检查；所有工作项必须有明确归属与结果。只说“加 semaphore”或“用 channel”不构成通过。

## 场景

高峰期每秒到达 50 个解析请求，输入对象平均 64 KiB。解析需要共享数据库句柄，最多允许 3 个解析并行。处理完成后每个请求要写入一个响应消息；客户端可能变慢，响应消费者单次只在它显式释放 gate 后才取一项。进程只给该流水线预留 4 MiB 内存。要求最多 4 个固定 async worker，排队上限由方案明确选择；不许无界 spawn 或无界 channel。

评审下列三个实现变体，并修复给定的错误版本：

1. listener 每收到请求就 `spawn` 一个 task；task 内 `acquire_owned` 数据库 Semaphore 后解析，再向 response channel `send`。
2. listener `try_send` 到 bounded input channel，Full 时直接 drop 请求并计成功。
3. 4 个 worker 共享 input queue 与 semaphore，但持 permit 等待 response channel 空位；response consumer 要收齐本批次 worker 报告后才开始 receive。

## 必须提交的检查工件

- **容量账本**：以输入对象、最大 queue capacity `Q`、worker 数 `W=4`、解析 permit `C=3` 和 response queue capacity `R` 明确列出各阶段可能同时持有的对象数。说明 4 MiB 如何约束 Q/R；不要把 semaphore 许可数当成全系统对象数。
- **修复结构**：使用 bounded input queue 和 bounded response queue；至多 4 个 worker 从前者取工作。permit 只覆盖解析数据库资源的阶段，写入结果前归还；不在 listener 为每个请求创建 waiter task。
- **过载契约**：指定队列满时 producer 是 await backpressure、带 deadline 拒绝还是按业务规则拒绝，并说明每条被拒绝的原请求由谁报告/回收；关闭时不得把 Full/Closed 记成成功。
- **确定性轨迹**：为 `Q=1`、单 worker、单 permit 设计 release gate 轨迹，证明慢处理使 input 队列满，producer 得到背压；开放 gate 后所有已接收 ID 恰好交付一次。对同时就绪事件不假设固定 scheduler 顺序。
- **回归检查**：一个错误实现必须能稳定失败，覆盖超额活动数、无界等待者/队列、丢失/重复结果或 permit 被结果等待占用中的至少一种；附上从干净起始快照运行的命令与结果。
- **公平性说明**：说明有限输入、consumer 最终持续读取、worker/job 最终完成时如何验证每项最终有结果；不得承诺消费者永不读取时仍保证进展。

## 验收判据

| 维度 | 通过条件 |
|---|---|
| 有界性 | input 和 response 两端都有限；worker 数固定；不存在随输入增长的等待 task 集合 |
| 数据完整 | accepted ID 恰好一次出现在结果，reject/close 有可见错误和 payload 归属 |
| 并发预算 | 数据库活动峰值 ≤ 3；permit 不跨越 response backpressure 等待 |
| 慢消费者 | gate 控制时观察到队列饱和和上游背压；恢复消费后工作可继续 |
| 稳定性 | 从干净快照重复至少 10 次同一结论；失败反馈指出资源或数据不变量 |

答案权限：独立提交前不要打开 `private-assessment/m14-l06-evaluation.md`。看过答案后仍可练习，但这次提交不记录为未见答案的能力证据。
