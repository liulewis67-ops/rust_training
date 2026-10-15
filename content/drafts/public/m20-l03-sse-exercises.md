# M20-L03：三道短练习

## 1. 预测：两个订阅者和断线清理

**契约**：打开一个 SSE Router response 后 `active_subscriptions == 1`；打开第二个后为 2。向两个订阅者广播 `id=1,data=update`，两个连接都能读到该帧。drop 第一个 response 后计数为 1，第二个仍能收到下一帧；drop 第二个后计数回到 0。

预测下面基线的资源计数和帧结果，并解释为什么 `Last-Event-ID` 不替代新的 server-side 订阅：

```text
open A → open B → publish update → drop A → publish finish → drop B
```

**提示**：response body 所有权和 detached task 所有权是两条不同生命周期。

**验证合同**：两帧都由活跃 stream 正确收到；本节公开 baseline 在每个 drop 后仍泄漏对应 guard；修复版的序列应是 1 → 2 → 1 → 0。

## 2. 修复：订阅 guard 被 detached task 持有

公开 `sse_handler` 当前将 `SubscriptionGuard` 移入一个永不结束的 `tokio::spawn`，而 response stream 只持有 receiver。修复 handler，让 guard 与 receiver 一起由 SSE response stream 持有；事件正常发送，连接取消/Body drop 后同步释放这个 stream-owned 订阅。

**提示**：stream 每次产生 item 时要把仍存活的 receiver 和 guard 放回 unfold state；stream 返回 `None` 或 response body drop 时，state 应离开作用域。

**验证合同**：公开断开测试从 1 降到 0；多个连接只释放被 drop 的那一个；事件仍保留 `id` 和 `data` 并继续投递给其他活跃订阅者。

## 3. 补全测试：独立生命周期与重复连接

在公开合同基础上补两项测试：

1. 连续打开并 drop 8 个连接，每轮返回后活动订阅数为 0。
2. 同时打开 A/B，A 收到第一事件后关闭，B 收到后续事件；断开 A 不能关闭共享事件总线或释放 B 的资源。

**提示**：publish 前两条 stream 都必须已订阅；body receive 用小于 1 秒的 timeout，避免测试在 bug 状态下永久挂住。

**验证合同**：固定 seed/顺序下两条测试确定性通过；错误答案若只模拟 guard counter、未通过 Router 打开真实 Sse body，不满足测试范围。WebSocket 握手和浏览器 EventSource 跨网络重连是挑战/环境验证，不属于本 crate 断言。
