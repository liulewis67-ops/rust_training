# M15-L01 短练习：取消安全与中间状态

## 1. 预测：选择取消分支后发生了什么

`select!` 在 `write_record` 和 cancel receiver 间等待；cancel 先 ready，但 write future 已更新本地阶段字段并发出一次消息。说明落选分支还会不会继续执行，以及已发生的消息是否自动撤回。

**契约**：明确 future drop 会停止后续 poll，但不回滚已经提交的副作用；提出至少一个幂等/事务/补偿边界。

**提示**：future 是可恢复的工作描述，不是自动数据库事务。

**验证**：私有 rubric 检查“取消必然撤销写入”的错误断言被识别。

## 2. 修复：取消后不能留在 Prepared

修复 starter 的 `prepare_then_commit`，使成功到 Committed，而 future 被 drop 或 gate sender 被 drop 时回到 RolledBack。不得通过忽略 cancel、强行打开 gate 或篡改检查实现。

**契约**：只允许 Idle、Committed、RolledBack 作为操作边界状态；取消后绝不残留 Prepared。

**提示**：在 await 前创建 guard，并用 Drop 实现仅在尚未提交时回滚本地状态。

**验证**：分别验证 gate 成功、gate closed 和显式 drop future 三条路径。

## 3. 实现：取消等待后仍取回 task 结果

补全 `wait_or_cancel`，以 `&mut JoinHandle` 为 select 分支。先让 task 等待 release gate，再让 cancel 通知胜出；函数返回 WaitCancelled 后打开 gate 并 await 原 handle，取回实际值 `42`。

**契约**：停止本轮等待不等同于 abort；结果仍可收集。另说明需要真正停止 task 时使用什么显式动作及如何观察终态。

**提示**：保留 JoinHandle 在外层，select 使用可变借用。

**验证**：oneshot gate 确定顺序；不以 sleep 或 is_finished 猜 task 是否已停止。

## 答案与尝试

独立提交前不要读取 M15 私有评分与参考实现。查看提示仍可继续学习，但不能将此次记录为未看答案的独立能力证据。
