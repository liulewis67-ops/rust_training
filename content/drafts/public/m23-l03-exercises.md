# M23-L03 三道短练习

## 预测：识别容量饱和

同一个 60 秒窗口中，服务 A/B 的 offered rate 都是 700 req/s。A 完成 698 req/s、p95 为 38 ms、窗口末 pending 为 4；B 完成 690 req/s、p95 为 620 ms、窗口末 pending 为 580。判断 B 的 throughput 表面变化能否说明容量充足，指出还要检查的失败/超时/队列/资源信号，并提出一项可证伪的复测。

**契约：**区分 offered 与 completed throughput；不拿平均值代替尾延迟；明确 pending 增长表示工作未完成。复测需固定负载模型、数据、机器、窗口及生成器余量，并报告 p95/p99、errors 和队列趋势。

**提示：**B 的已完成速率接近 A，但大量工作只是在窗口末排队；短窗口未必看出队列最终代价。

## 修复：让 p95 包含排队时间

修复 `summarize_window` 的端到端 latency 计算。当前代码从 `started_ms` 到 `completed_ms`，应从 `offered_ms` 计到完成；维持合同测试中的 nearest-rank p95、completed throughput 和峰值 in-flight。

**公开检查：**两个请求分别在 0 ms 和 80 ms 到达，100 ms 与 110 ms 完成；端到端 latency 为 100、110 ms，最近秩 p95 应为 110 ms，而不是执行时间 100、30 ms 的 p95。

**提示：**排队期间请求已占用用户可观察的端到端时间。`started_ms` 适合分析服务阶段，不是此合同的分位数起点。

## 实现：补充过载回归测试

给摘要器添加回归测试：在 1,000 ms 测量窗口内，3 个请求已 offered，2 个 completed，1 个到窗口末仍 pending。断言完成吞吐按 2/1 秒计算，pending 数仍为 1，且未完成请求没有被当成零延迟塞进 p95 样本；另验证两条重叠的已启动请求峰值 in-flight 为 2。

**契约：**新测试不修改生产摘要器或 fixture，不以 `unwrap_or(0)` 隐藏 pending；测试需在原缺陷修复后通过。

**提示：**吞吐分子是 completed 数，latency 样本是有明确完成时间的请求；pending 是单独可观察的指标。
