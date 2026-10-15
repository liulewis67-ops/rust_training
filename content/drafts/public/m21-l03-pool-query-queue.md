# M21-L03：连接池、慢查询与队列堆积

## 学完后

- 根据连接获取等待、查询延迟和队列深度等独立证据提出可证伪的诊断假设。
- 区分“连接池已满导致等待”“查询执行耗时高”“工作队列接近容量”三个信号。
- 通过一项有针对性的复现和回归验证假设，不把相关性冒充根因。

## 先修

完成 M21-L02，能区分业务结果、平台故障和服务边界。M21-L01 的 request ID 用于在日志/trace 中关联单次请求；M21-L02 的延迟分布与有界标签用于看整体趋势。

## 观察阶段，不先下根因

连接池保护数据库最大连接数，并复用既有连接。SQLx `Pool::acquire()` 在连接上限已满、连接都被借出时会等待；等待时间包括获取许可、连接健康检查和新建连接等阶段。因此“慢 API”或 acquire wait 单独升高，并不能直接证明查询本身慢。观测连接获取耗时、池上限/使用数、查询耗时分布，并查看慢查询日志或数据库计划，才能缩小范围。

对于同一 request/run，按边界记录 `pool_acquire_wait_ms`、`db_query_duration_ms`、`queue_depth` 和当前 `queue_capacity`。p95/p99 能显示尾延迟，不要只看平均值。池等待高且所有连接都被借出，支持池压力假设；查询延迟高但池等待低，支持查询路径假设；队列接近容量且消费速率低于进入速率，支持队列堆积假设。池等待也可能来自连接建立或网络检查，真实数据库指标才有进一步区分能力。

## 用联合证据区分三类情况

| 观测 | 先验证的假设 | 下一步证据 |
|---|---|---|
| acquire wait 高、in-use 达到 max、query duration 正常 | 连接池压力/持有过久 | 检查连接占用区间、事务持续时间、并发与池限额；确认应用总池上限没有超过数据库容量 |
| query duration 高、acquire wait 低 | 查询或锁等待慢 | 用同一 query family 的数据库侧统计、执行计划、锁等待和数据规模做对照 |
| queue depth 增长并接近 capacity | 生产速率持续超过消费速率 | 比较 enqueue/dequeue rate、worker 并发、重试放大和下游依赖；确认拒绝/背压行为 |

这些现象可以同时出现。增加池连接数可能把排队压力转移到数据库，增加 worker 可能放大数据库饱和；修复前先记录基线，改一个可解释的变量，再用相同负载观察相同时间窗。Tokio 有界 mpsc 会提供固定最大 buffer capacity，queue depth 应与 max capacity 分开解释；不断增大的无界队列会把拥塞改成内存增长和更长的等待。

## 最小复现与回归

本节 starter 提供不可变快照，按三个独立规则产生“待验证 finding”：acquire wait 高且池满、查询 p95 越阈、队列达到容量 80%。允许一次快照返回多个 finding；它们是证据线索，不是已证实根因。fixture 没有真正运行 SQL、占满连接池或阻塞 worker。学习者需写测试将三个特征分开，并证明同时出现时三个 finding 都保留。

真实排查应按以下顺序收集证据：

1. 固定问题窗口、route/query family、实例和 request/run 关联标识。
2. 同时比较 acquire wait、query duration、队列深度/容量、请求到达速率和完成速率。
3. 明确一个可证伪假设及预测，例如缩短连接持有范围后，池等待 p95 应下降但 query duration 未必改变。
4. 在隔离环境注入目标故障，记录原始症状；一次只改一项。
5. 用相同观察点验证预期信号变化并加回归测试；结果不符时撤销假设。

## 诊断边界

线程/任务排队、Tokio executor 饱和、连接池排队、数据库锁等待是不同位置的等待。仅看一个 queue depth 或请求延迟不能相互替代。应记录队列容量和时间趋势，不能把「当前长度低」当成没有堆积证据：突发、瞬时样本和 worker 拉取方式会影响解释。生产环境中还需要 per-query redaction、固定 query family 和权限受控的数据库诊断访问。

## 分层提示

1. acquire wait p95=240ms、query p95=18ms、pool in-use 达 max，首先支持哪个假设？还有哪些替代解释？
2. query p95=900ms 但 acquire wait 正常，查连接数是否能验证 SQL 慢？
3. queue depth=96、capacity=100，但 dequeue rate 与 enqueue rate 如何影响“将持续堆积”的判断？
4. 为什么增大连接池或 worker 数可能把问题移到数据库，而不是消除它？
5. 哪些属于已有观测事实、待验证假设、验证结果？如何用同一时间窗口比较？
6. 查询延迟和池获取等待应使用哪个 request/run 关联字段？标签应使用 query 文本还是 query family？
7. 同时满足池等待与队列高水位时，为什么不能只返回第一个 finding？

## 来源

- [SQLx 0.8.6：Pool](https://docs.rs/sqlx/0.8.6/sqlx/struct.Pool.html)：连接池上限、借出后等待和连接复用语义。
- [SQLx 0.8.6：PoolOptions](https://docs.rs/sqlx/0.8.6/sqlx/pool/struct.PoolOptions.html)：连接上限、获取超时和池配置入口。
- [Tokio：bounded mpsc Receiver](https://docs.rs/tokio/latest/tokio/sync/mpsc/struct.Receiver.html)：当前 `capacity()` 与固定 `max_capacity()` 的区别。
- [Google SRE：Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)：延迟分布与时间窗聚合的解释边界。

作者侧 fixture 仅验证静态快照的 finding 规则；没有启动 PostgreSQL、Linux 容器或真正的队列/连接池故障。真实 SQLx pool、锁等待和队列服务故障属于正式 R3 实验验收，不能以这些 fixture 代替。
