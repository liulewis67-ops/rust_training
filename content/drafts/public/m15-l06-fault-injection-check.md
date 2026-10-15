# M15-L06 独立检查：取消、超时、失败同时出现的故障注入

## 考核目标

在没有看过私有参考答案的情况下，解释并修复一个任务执行批次：取消信号、绝对 deadline 和 work failure 可在同一调度窗口就绪。系统必须按给定优先级选择一个终态，每个已接 task 恰好报告一次、清理恰好一次；批次返回前所有 task 已 join。

本题是 I07 的作者侧独立检查稿。题面用于未见变式演练，当前本机测试不能代替真实独立学习者证据，也不能自动标记正式技能通过。

## 学习者可见契约

1. 输入 ID 唯一；每个被接纳的 ID 最终恰有一项 `TaskReport`。
2. 一项工作若同时有多个 ready 信号，优先级固定为 cancellation > work result > deadline。该策略通过 biased select 显式表达，不依赖随机分支顺序。
3. work success、retryable failure、permanent failure、cancellation、timeout 各自进入不同终态。
4. 每个 task 恰好调用一次清理；cleanup 不重复写回终态、不重复释放 permit。
5. 批次 drain JoinSet 直到为空；退出前没有遗留 task，join error 单独计数。

## 陌生变式

题目给出四项 job：31 同时就绪 retryable failure/cancel/deadline；32 同时就绪 permanent failure/deadline；33 deadline 前成功；34 deadline 到期且没有 work/cancel 信号。学习者需用原契约推导终态并修复实现；随后系统随机重编号、改变 job 输入顺序，并追加一个失败 task，要求仍保证每个 ID 恰好一次、cleanup 次数等于加入批次的 task 数、JoinSet 为空。

## 时间与执行边界

使用受控 oneshot gate 和虚拟 Tokio deadline；不依赖真实 I/O 或 Linux 容器。故障事件先在 gate 中就绪，随后统一启动批次。对同时 ready 的信号用文档化优先级判断；对其余不同 task 的完成顺序不作断言。独立提交前隐藏所有私有 reference、mutation name 和评分解释。

## 失败反馈

- **重复结算/重复清理**：定位从单一仲裁结果到 finalize/cleanup 的控制流；每 task 只保留一个公共收尾出口。
- **取消误报成功**：核对 branch 输出枚举，不要只验证 signal receiver 已关闭。
- **timeout/failure 丢失**：确保 deadline 和 work error 各有 terminal variant，不并入 generic success。
- **遗留 task**：返回前消费 `JoinSet::join_next()` 到 `None`，并检查 JoinError。
- **答案证据污染**：看过参考实现后的成绩只能用于练习，不记为未见答案的独立技能证据；平台/环境故障单独记录，不降低技能分。

## 重置与技能证据

每次正式尝试从版本化 starter snapshot 创建隔离副本；保存 starter SHA、测试/validator 版本、提交 snapshot SHA、修复前后完整日志、未看答案标志、每项 ID 的 terminal/cleanup 记录及技能反馈。重置只恢复副本，保留原始检查包和既有尝试记录。正式通过须 I06/I07 前置、共用门槛 A、R2 环境和独立提交均满足。
