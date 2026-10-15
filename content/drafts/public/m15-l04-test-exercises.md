# M15-L04 短练习：可重复的异步测试

## 1. 修复：事件 gate 的结果

修复 `wait_for_gate`：发送方在测试开始等待前已经通过 oneshot 发送事件时，函数应立即返回 `GateOutcome::Released`；超出 grace period 则返回 `Deadline`。

**契约**：结果由事件是否到达决定；不读取 wall clock、不引入 sleep；事件分支不能被误报为超时。

**提示**：查看 `select!` 两个分支的结果映射，接收分支当前返回了什么？

**验证**：`event_gate_releases_before_deadline` 用已发送的 oneshot 检查事件路径。故意错误的 starter 每次稳定返回 Deadline。

## 2. 实现：deadline 前的 interval tick 数

实现 `ticks_before_deadline(period, budget)`：从第一个 `period` 到期时开始计数，每次 tick 使用同一个绝对 deadline；deadline 前已就绪的 tick 加一，超时后返回计数。

**契约**：period 必须大于零；deadline budget 固定，不随循环重置；Tokio paused clock 的十秒窗口和三秒 period 应得 3 次 tick。不要断言与 deadline 同时到期的 timer 顺序。

**提示**：`interval_at` 的首个 tick 不立即完成；每一轮都用原 deadline 包 `tick()`。

**验证**：`interval_count_uses_one_virtual_deadline` 在 `start_paused` runtime 里检验结果，无真实等待。

## 3. 设计评审：查出 flaky test

评审一个测试：task A 和 B 都 `sleep(10ms)` 后写入共享 `Vec`；主测试再 `sleep(12ms)` 并断言 `[A, B]`；另一个测试保留全局计数器。

**契约**：指出真实时间误差、无明示的同刻顺序、状态隔离三类风险，并给出 gate/paused clock/局部状态的替代方案。测试不得将某一次排程观察伪装为稳定契约。

**提示**：分别说明事件发生顺序、测试时间推进方式和测试之间的数据生命周期。

**验证**：评审记录逐项核对三个风险和对应替代策略；本地 crate 另将被测 timer 测试重复运行十次。

## 答案与尝试

独立提交前不要读取 M15 私有评分与参考实现。查看提示仍可继续学习，但不能将此次记录为未看答案的独立能力证据。

## 先修

M15-L03：优雅停机、清理与截止时间。
