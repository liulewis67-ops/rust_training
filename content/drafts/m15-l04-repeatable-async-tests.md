# M15-L04：可重复的异步测试

## 学完后

- 用 oneshot gate 控制事件先后，不用 wall-clock sleep 猜测 task 排程。
- 用 Tokio paused clock 验证 deadline 与 interval；区分 `advance` 的跳时语义和定时器实际被 poll 的时机。
- 重复运行同一测试契约，定位依赖真实时间、未固定事件顺序和共享状态泄漏造成的 flaky test。

## 先修

完成 M15-L03，理解 deadline、join 和 task 终态。本节在 Tokio current-thread test runtime 中测试本地 async 时间；真实网络与容器 I/O 由受控模拟器覆盖。

## 先固定事件，再验证时间

如果测试目的是“事件先到时返回哪个分支”，创建 oneshot gate，先发送再调用被测 future。这个顺序由 channel 因果关系固定，和 CPU 速度、CI 负载、线程唤醒次序无关。若测“没有事件直到 deadline”，让 sender 保持存活但不发送，然后让 paused Tokio clock 推进到 timer。

```rust
#[tokio::test(start_paused = true)]
async fn deadline_is_repeatable() {
    let (_keep_sender_alive, event) = tokio::sync::oneshot::channel();
    let result = wait_for_gate(event, std::time::Duration::from_secs(5)).await;
    assert_eq!(result, GateOutcome::Deadline);
}
```

`start_paused = true` 要启用 Tokio `test-util`，且该测试使用 current-thread runtime。paused time 只影响 Tokio 的 clock，不会暂停 `std::time::Instant` 或真实 I/O。若测试里仍要等真实网络，paused clock 的 auto-advance 可能让逻辑时间先跳到 timer；把 I/O 放进受控模拟器或显式同步 gate。

## advance 与自动推进不是同一个工具

`time::advance(delta)` 把虚拟时钟一次跳到新时点。越过同一次跳跃范围的多个 timer 会同时 ready，runtime 可以用任意顺序 poll 它们；advance 返回也不保证每个被越过的 timer 已经完成。因此它适合验证“跳过一段时间后状态如何”，不能单独用来断言多个同刻 timer 的精确顺序。

想可靠等待单个 timeout，优先在 paused runtime 中 await `time::sleep(duration)` 或含 sleep 的 API；Tokio 会在 runtime 空闲时自动把时钟推进到下一个 timer，并处理 timer。要检查 interval，可用一个绝对 deadline 包住每次 `tick()`，让总预算不随循环重置；测试选取不与 deadline 重合的间隔，避免把同时到期策略混入目标契约。

## 重复执行并排查共享状态

一个确定性测试重复多次仍应给出相同结果。测试不应依赖随机 task 排序、全局 mutable singleton、真实 `sleep` 时长或前一个测试遗留的 runtime state。每个测试自建 gate、数据与 runtime；需要随机输入时 seed 固定并打印 seed；同刻事件则明确说明优先级，或只比较无序结果集合。

重复通过不能证明没有所有竞态，但同一释放计划若在 paused clock 和 isolated runtime 下也得出不同断言，通常说明契约未固定，而不是“再多 sleep 一点”就稳了。

## 分层提示

1. **事件提示**：怎样证明 gate 已经发送，而不用 sleep 等待“应该已启动”的 task？
2. **时钟提示**：测试中的 `Instant` 是 Tokio 的虚拟时钟，还是 `std` 的 wall clock？
3. **advance 提示**：越过的几个 timer 会按注册顺序执行吗？advance 返回能保证什么？
4. **deadline 提示**：循环里反复创建 `now() + budget` 会把总运行时间变成多少？
5. **隔离提示**：连续运行同一测试，哪些共享变量、任务与 sender 必须在测试内重新创建？

## 来源

- [Tokio test macro：paused test runtime](https://docs.rs/tokio/latest/tokio/attr.test.html)
- [Tokio `time::advance`](https://docs.rs/tokio/latest/tokio/time/fn.advance.html)
- [Tokio `time::pause` 与 auto-advance](https://docs.rs/tokio/latest/tokio/time/fn.pause.html)

官方文档用于核对 `start_paused` 的 runtime/feature 限制、Tokio 时钟与 std 时钟的差异、`advance` 的限制和 paused time auto-advance；gate 设计与重复执行契约为原创。作者稿尚未通过正式 R2 与独立学习者验收。
