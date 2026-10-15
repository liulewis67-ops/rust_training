# M15-L03 短练习：优雅停机、清理与截止时间

## 1. 预测：排空等待超过 deadline

一个 `JoinSet` 有三项工作，`timeout_at(deadline, set.join_next()).await` 返回 Elapsed。说明下一步要做什么、哪些任务仍可能运行、如何收集它们最终的取消结果。

**契约**：Elapsed 只结束本轮 join_next 等待；必须显式发 abort 或继续协议化 drain，并最终 join 所有 tracked task。

**提示**：deadline 到期后，JoinSet 变量还在调用方手里吗？

**验证**：在受控 set 中留下一个等 gate 的 task，验证没 abort 时集合仍有未完成工作。

## 2. 修复：使用一个绝对 drain 截止时间

修复 starter 的 `drain_until_deadline`。正常 drain 收齐结果；deadline 到后 `abort_all()` 并继续 `join_next()`，逐项统计 Cancelled 与已自然完成的结果。不可在每轮循环重新创建 grace period。

**契约**：函数返回时 JoinSet 为空；已成功结果不丢，异常和取消数量准确；不承诺抢占同步阻塞代码。

**提示**：abort_all 发请求，哪个循环负责确认终态？

**验证**：正常路径预先释放多个 gate；到期路径保留一个 closed gate task，传入 `Instant::now()` 验证显式取消。

## 3. 实现：完整停机记录

补全受控测试，使三个已接工作恰好一次出现在 completed results；另一个变式让 deadline 前只完成一项，其余应进入取消统计。对同时 ready 的结果只比较集合，不写固定顺序断言。

**契约**：所有 accepted ID 归类为 completed/failed/cancelled；没有遗留 tracked task，错误实现“Elapsed 直接返回”会失败。

**提示**：绝对 deadline 是预算边界，不是取消动作。

**验证**：测试使用 current-thread runtime 和 channel gates，重复运行同一 release 计划结果不变。

## 答案与尝试

独立提交前不要读取 M15 私有评分与参考实现。查看提示仍可继续学习，但不能将此次记录为未看答案的独立能力证据。
