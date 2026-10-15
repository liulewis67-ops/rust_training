# M21-L02：指标、SLO 与失败分类

## 学完后

- 用明确定义的 SLI 分子、分母和半开时间窗计算服务目标。
- 区分 API 可用性、执行平台可用性和学习者代码结果，避免业务错误与平台故障混为一类。
- 为指标选择有限、稳定的属性；把 request ID、用户 ID 和任务 ID 留在受控日志或 trace。

## 先修

完成 M21-L01，知道 `request_id` 用于单次请求关联；指标则回答一段时间内的总体趋势。还需理解成功响应、业务拒绝、用户代码失败和基础设施失败的语义不同。

## SLI 先定义事件，再算比例

Service Level Indicator（SLI）是从服务事件计算出的量化指标。对本练习的 HTTP API，可先把**所有有效业务请求**作为 eligible denominator：成功响应和契约预期的业务拒绝都表示 API 可达；服务端故障属于坏事件。具体服务必须在目标中声明哪些请求属于有效分母，不能在看到结果后临时排除慢请求或错误请求。

```text
API availability SLI = good eligible API requests / all eligible API requests
```

执行平台是另一个服务边界：runner 完成一次执行、即使正确结果是编译错误或测试失败，都证明平台完成了受托工作；runner 自身无法启动、丢失结果或超出平台资源故障合同则是坏事件。学习者代码不通过是课程结果，不是平台可用性故障。两个 SLI 有各自的分子、分母和目标，不合并成一个能相互抵消的总分。

## 窗口、阈值和错误预算

本节按 UTC 秒时间戳使用半开区间 `[start, end)`，因此边界事件只属于一个窗口。没有 eligible 事件时结果是“无数据”，不能当作 100% 成功。目标用百万分比表示，避免教学样例的浮点舍入：99.5% 对应 `995_000 / 1_000_000`。精确比较 `good × 1_000_000 ≥ target_ppm × eligible`，同时把目标限制在 0 到 1,000,000。

SLO 是某个时间窗上 SLI 的目标。若目标为 99.9%，同一窗口允许约 0.1% 的坏事件作为 error budget；预算是允许的失败比例，不代表实际失败可以忽略。短窗用于快速告警，较长窗用于判断目标与预算趋势，不能把短窗的“无事件”当作目标达成。

## 分类与 metric dimensions

把输入先建模为有限枚举，再映射至固定的 `route` / `outcome` / `status_class` 等维度。API 业务拒绝可按已声明的服务合同计入可用；API 服务端错误计入 API SLI 坏事件。runner SLI 中，编译错误或断言失败仍是成功完成服务，runner 平台不可用才是坏事件。若要跟踪学生失败数量，另设业务结果计数器，不把它并入平台错误预算。

Counter 适合累计请求、失败或完成次数；Gauge 适合当前排队量等可升可降快照；Histogram 适合延迟分布。平均延迟会掩盖尾部延迟，延迟 SLI 通常直接定义阈值内请求比例，例如 `duration_ms ≤ 300` 的有效请求数 / 所有有效请求数。每个指标维度组合会产生新的时间序列，所以 route 必须使用 `/users/{id}` 这类模板，不能使用原始 path。OpenTelemetry 以 metric name 和属性组合识别时间序列；Prometheus 建议谨慎控制 label 数量与基数。具体基数限制随 SDK/部署配置而定，不能把文档中的示例上限当作所有系统的保证。

`request_id`、`user_id`、`task_id` 会随事件数增长，不适合作为 metric label。request ID 放到 M21-L01 的受控日志 / trace 中用于单次诊断；指标只放有限枚举、route template、状态类别或版本化实验名。对业务细分的需求先问是否有有限域，避免把任意输入塞进 label。

## 可靠性与平台故障

不要将 4xx 一律视作成功，也不要将其一律视作失败；契约要区分预期业务拒绝、无效请求和服务端故障。此 lesson 的 fixture 将“资源不存在”定义为 API 已正常处理的预期业务结果；其他产品可采用不同的有效请求约束，但必须固定并说明。若网关、数据库或 runner 的遥测采集失败，应将缺失/平台故障作为单独信号观测，不把 telemetry pipeline 的错误悄悄记为业务成功。

## 分层提示

1. 本窗口的 404 是契约预期的“资源不存在”。它为何不等于“handler 没运行”或“平台不可用”？
2. API 返回成功，但 runner 没有生成任务结果；分别更新哪个 SLI？
3. 用户代码编译失败和执行环境启动失败分别属于什么结果？它们能否进入同一个错误预算？
4. `[10, 20)` 的窗口应如何处理时间戳为 10、19、20 的观测？
5. 没有请求样本时为什么不能报 100% availability？
6. 每请求 `request_id` 作为 metric label 会造成什么成本？需要追查某一次请求时该查哪个信号？
7. 请求延迟应选 Counter、Gauge 还是 Histogram？平均值可能遗漏什么？

## 来源

- [OpenTelemetry Metrics Data Model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)：metric stream、属性维度、Counter/Gauge/Histogram 时间序列语义。
- [OpenTelemetry Metrics SDK](https://opentelemetry.io/docs/specs/otel/metrics/sdk/)：SDK cardinality limit 的配置概念；具体配置值依实现与配置而异。
- [Prometheus instrumentation practices](https://prometheus.io/docs/practices/instrumentation/)：counter/gauge/histogram 选择、label 基数与 `rate()` 实践。
- [Google SRE：Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)：SLI/SLO、错误预算与按时间窗评估。

Starter 只提供纯 Rust 窗口分类 fixture，不连接数据库、metrics SDK、collector 或 R3。生产 SLO、采样策略、延迟桶、告警窗口和 telemetry pipeline 仍需结合真实服务合同确定。
