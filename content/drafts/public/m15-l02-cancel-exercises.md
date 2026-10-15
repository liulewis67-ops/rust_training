# M15-L02 短练习：drop handle、abort 与协作取消

## 1. 预测：drop 和 abort 的结果差异

一个 task 正等待 gate，调用方分别执行 `drop(handle)` 和 `handle.abort(); handle.await`。对比 task 是否收到取消、是否能收集输出、谁负责清理，并说明 `spawn_blocking` 已运行时能否依赖 abort 停止。

**契约**：正确区分 detach、异步 abort 请求和已 join 的终态；不把 drop 说成停止。

**提示**：drop 会丢掉哪个能力？abort 后哪个 Future 能证明 task 已经结束？

**验证**：用 release 与 done oneshot 观察 detached task 继续运行；另一个 gate test await cancelled JoinError。

## 2. 修复：协作取消必须返回自己的终态

修复 `work_or_cancel`。收到协作信号时释放/归还当前工作状态并返回 `WorkerOutcome::Cancelled`；工作 gate 先到时返回 Completed。错误实现把 cancel 分支当成功完成。

**契约**：协作取消产生可观察的业务终态与清理记录；不依赖 Tokio abort 来模拟合作收尾。

**提示**：应用定义的 `Cancelled` 是 task 正常输出，还是 JoinError？取消选择分支后还要做什么？

**验证**：发送 cancel 后 join 返回 `Ok(Cancelled)`，cleanup 信号已发生；先释放 job gate 则返回 Completed。

## 3. 实现：证明停止完成

补全事件测试：保留 JoinHandle，发送 abort 后 await 并检查 cancelled；另用独立的协作取消 gate 检查 cleanup 先发生再返回 Cancelled。不要仅调用 `is_finished()`。

**契约**：停止请求与停止完成分离；所有已接收工作有 Completed/Cancelled/Failed 终态，不丢 join 错误。

**提示**：abort handle 用于发请求，JoinHandle await 用于收集终态。

**验证**：所有先后关系由 oneshot gates 决定，current-thread 模式下重复运行稳定。

## 答案与尝试

独立提交前不要读取 M15 私有评分与参考实现。查看提示仍可继续学习，但不能将此次记录为未看答案的独立能力证据。
