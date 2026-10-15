# M20-L04：后台任务、持久状态和恢复

## 学完后

- 区分 HTTP 接受任务、worker 执行尝试和业务最终状态。
- 将队列、尝试次数、检查点、重试时间与租约代次写入可恢复的持久记录。
- 进程重启后只恢复符合策略的任务，并用 fencing token 拒绝旧 worker 的迟到回传。

## 先修与边界

实施顺序依赖 M20-L03。此作者侧预写先用标准库文件日志演示“关闭 store，再用相同路径打开”后的状态恢复；它不是生产任务队列，也不替代 I10-F02 PostgreSQL task/event 事务合同、并发领取、R3 故障注入或 M20-L03 正式验收。本地练习不运行 Linux 容器或 PostgreSQL。

## 接受请求不等于执行成功

HTTP `202 Accepted` 只表示服务已接受处理。客户端拿到 task ID 后，worker 可能尚未启动；请求连接断开、API 进程退出或 worker 崩溃都不能让任务状态消失。内存 channel 可以作为唤醒提示或短期调度优化，但持久存储才是业务状态真相。进程重启后从持久记录重建可运行队列。

持久行需要足以解释恢复决策的字段：`task_id`、当前状态、attempt、`lease_generation`、租约截止时间、下一次重试时间、最近安全检查点以及终态/结果摘要。状态迁移与这些字段应在同一数据库事务中写入。若“领取成功”只增加了 worker 内存队列、还没有可靠记录，重启就无法判断任务由谁持有。

## 状态机与恢复策略

本节用 `Queued`、`Running`、`RetryScheduled`、`Succeeded`、`Failed`、`Cancelled` 六态。终态不自动重新执行；永久失败需要显式人工重开策略。启动恢复对每条持久状态按策略处理：Queued 可以领取；RetryScheduled 仅在 retry_at 到期后领取；租约尚有效的 Running 暂不被其他 worker 抢占；租约过期的 Running 可从最后检查点重新领取；成功、永久失败和取消保持终态。

重试必须有界并复用 M20-L02 的错误分类和 deadline。检查点只能标在已完成、可安全重放边界；若副作用已经提交但 checkpoint 尚未提交，恢复仍可能再次调用该副作用。把状态和副作用放在同一事务，或让外部副作用具备幂等键，才能避免“任务只做一次”的错误承诺。

## 租约与 fencing token

worker A 获得 generation 7 的租约后暂停，租约过期；协调器把任务重新领取给 B，并持久写入 generation 8。A 恢复时，即使它仍认为自己持有任务，写结果必须带上 generation 7，并由数据库条件更新要求当前 generation 仍相等。更新影响 0 行表示 A 已过期，不能覆盖 B 的结果。每次重新领取都要严格递增代次；溢出应失败，不能回绕复用旧 token。

租约解决“何时允许重新尝试”，fencing 解决“迟到旧 worker 能否写入”。只有租约没有条件写入，过期 worker 仍可能覆盖新 worker。内存锁只能约束单进程，不能在多个 worker/实例间形成正确性边界。

## 先写恢复，再消费唤醒信号

正确顺序是事务性地写入状态/事件，再提交；之后通知 worker 或 SSE subscriber。若通知丢失，后台扫描器仍能从持久状态找到工作；若进程在写库与发通知之间退出，重启扫描或 outbox relay 仍可补发。不要让 Tokio channel 中的消息成为唯一任务副本。

本机 crate 将每次快照作为一条 append-only 日志记录并调用 `sync_data`，再通过关闭并重新打开文件验证进程生命周期之外的重建。它只用于教学地验证序列化、完整记录回读和恢复策略。文件日志没有数据库事务、跨进程锁、崩溃尾记录修复、容量治理、备份或复制，因此不能承载真实用户任务。Rust `File::sync_data` 的承诺受操作系统和存储栈语义约束；PostgreSQL 的提交持久性也由 `fsync` 与 `synchronous_commit` 配置影响，必须检查目标数据库配置和运行环境。

## 三道练习

1. 修复仅存在 `HashMap` 的 store：同一路径重新打开后任务状态必须恢复。
2. 实现恢复策略：筛出排队/到期重试/过期租约，保持未来重试和终态不动，并递增代次以 fencing 旧 worker。
3. 设计评审：为关闭中崩溃、租约到期后旧 worker 回传、外部副作用与 checkpoint 分离、数据库不可用写出安全顺序和不变量。

## 分层提示

1. API 返回 202 时任务记录和执行状态分别是什么？
2. 进程重启后哪些对象可以重建、哪些只能从数据库/日志还原？
3. 为什么不能马上抢占仍在有效租约内的 Running？
4. 重新领取后怎样让旧 worker 的 `UPDATE ... WHERE lease_generation = ?` 影响 0 行？
5. 状态持久化成功但通知失败时，哪个扫描/relay 路径能补上唤醒？
6. 副作用成功但 checkpoint 写入前进程崩溃，会发生什么？
7. 本地文件 `sync_data` 实测能证明哪些行为，不能证明数据库事务、并发领取和生产耐久性中的哪些部分？

## 来源

- [Rust `std::fs::File`](https://doc.rust-lang.org/std/fs/struct.File.html)：`write_all`、`sync_data` 与文件生命周期 API。标准库文档指出 `sync_data` 可能不同步元数据，平台实现也会影响具体行为。
- [PostgreSQL 18 Write Ahead Log 配置](https://www.postgresql.org/docs/current/runtime-config-wal.html)：`fsync`、`synchronous_commit` 以及成功返回与 WAL 刷盘的关系。
- [PostgreSQL 18 Reliability and WAL](https://www.postgresql.org/docs/current/wal.html)：持久恢复和 WAL 的数据库背景。

状态名、恢复时间点、代次和练习合同为原创教学示例。文件日志只作本地恢复模型，不构成 PostgreSQL/R3 验收。
