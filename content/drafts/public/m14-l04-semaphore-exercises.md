# M14-L04 短练习：Semaphore、队列与背压

## 1. 修复：permit 覆盖受限工作

修复 starter 的 `run_limited`，要求它从真正开始工作前持有共享 Semaphore permit，到工作结束后才归还。不得为每次调用新建 Semaphore，也不得先启动工作再排队等待 permit。

**契约**：受限区间的并发不超过共享上限；正常返回、错误退出和 task 取消都不会永久泄漏 permit。

**提示**：把 permit 放入局部变量并让它活过 `job().await`；closure 应在 acquire 成功后调用。

**验证**：由 oneshot gate 控制两项工作，确认容量为 1 时第二项必须等第一项释放，不用 sleep 推测并发。

## 2. 实现：有界队列过载行为

补全 `submit_or_return`，使用容量为 1 的 bounded mpsc。第一次提交后队列满时，第二项必须按题目选择的策略返回明确 Full，并让调用方拿回原始 payload；消费第一项后再次提交第二项应成功。

**契约**：队列长度从不超过配置容量；Full 与 Closed 可区分；不丢弃未接收 payload。

**提示**：非等待入口使用 `try_send`，观察 `TrySendError` 的分支并取回 message。

**验证**：断言队列容量、Full 返回原值、消费腾出空间后重试成功。

## 3. 设计评审：并发数不等于积压上限

评审一个入口：每个 HTTP 请求立刻 `tokio::spawn`，task 内先 `acquire_owned`，再处理。Semaphore 有 4 个 permit，需求峰值可能有 100,000 个请求。给出无界风险、最小有界队列/固定 worker 改造、满载策略和可验证的预算公式。

**契约**：清楚区分活动工作数、队列消息数和等待 task 数；说明容量、reject/backpressure 选择，以及错误/关闭时工作项的归属。

**提示**：仅有 semaphore 时，哪一项仍能随输入增长？bounded channel 的边界应放在 spawn 前还是之后？

**验证**：私有 rubric 检查预算清晰、消息不静默丢失、过载结果可观察、错误方案确实检出。

## 答案与尝试

独立提交前不要读取 M14 私有评分与参考实现。查看提示仍可继续学习，但不能将此次记录为未看答案的独立能力证据。正式评测还会区分平台超时与学员代码失败。
