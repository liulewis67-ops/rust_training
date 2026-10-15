# M20-L04：三道短练习

## 1. 修复：重启后任务消失

**合同**：写入 `task-a / RetryScheduled / retry_at=500 / checkpoint=chunk-3`，关闭 store，再用相同路径打开。查询仍返回原状态、时间和 checkpoint。坏基线只有进程内 `HashMap`，重开后找不到任务。

**提示**：先定义可重放的持久快照，再让 `open(path)` 从已提交记录重建 map；写入必须完整并检查错误。

**验证**：公开测试先确认进程内读取通过，再确认关闭/重开失败。正确实现从空日志开始，写入后 `sync_data`，重开回读后四个字段一致。

## 2. 实现：恢复并 fencing 旧 worker

**合同**：`Queued` 可立即领取；未来 `RetryScheduled` 保持不动、到期后可领取；`Running` 租约未过期时不可抢占、过期时新领取代次严格递增；`Succeeded/Failed/Cancelled` 不恢复。若持有者提交的 generation 低于当前值，拒绝完成任务。

**提示**：按状态和时间计算候选；对过期 Running，在返回给新 worker 前先持久化更高代次。使用 `checked_add`，禁止饱和或回绕。

**验证**：固定时间输入应产生确定结果；重复重启不能重新接受旧代次；`u64::MAX` 代次应返回明确错误且不修改旧快照。

## 3. 设计评审：关闭、崩溃与副作用

针对以下场景写状态迁移顺序、存储事务边界和恢复决策：

1. worker 收到 graceful shutdown，任务运行到一半；
2. worker 在外部副作用成功、checkpoint 写入前崩溃；
3. 租约过期并重新领取后，旧 worker 延迟返回成功；
4. 状态写入已提交，但进程在发送唤醒通知前退出；
5. 数据库暂时不可用，worker 无法续租。

**提示**：分别说明 durable state、唤醒提示、幂等副作用、lease 与 fencing 的职责；“重启后重新排队”不能替代副作用去重。

**评分合同**：正确设计持久化有界状态、可安全重试检查点、事务/outbox 或可重建扫描、generation 条件写入、续租失败停止提交。只依赖 channel、进程内 mutex 或租约时间而无 fencing 的答案不通过。
