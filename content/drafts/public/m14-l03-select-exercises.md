# M14-L03 短练习：select、超时与完成顺序

## 1. 预测：两个分支都 ready

两个 oneshot receiver 在进入 `tokio::select!` 前都已收到值。说明哪个 handler 会执行，以及默认 select 是否保证按源码中从上到下的顺序选择。

**契约**：答案说明任一合法分支可能胜出；若加入 `biased;`，再指出显式轮询优先级改变了什么责任。

**提示**：branch ready 不等于源码顺序就是完成顺序。

**验证**：在受控 current-thread Tokio test 中同时 send 两个值，只检查返回属于 Left 或 Right，不固定断言其中之一。

## 2. 修复：timeout 后仍要收集结果

一个已有 spawned task 正等待 release gate。修复调用方式，使 0 时限本轮等待返回 Elapsed 后，调用方仍能打开 gate 并收集 task 的实际 `42` 结果；不得把 task 误当成已取消。

**契约**：保留 JoinHandle 所有权，timeout 后 task 可继续完成，最终 JoinError/值仍有收集路径。

**提示**：timeout 包的是拥有句柄的 Future，还是对句柄的可变借用？

**验证**：gate release、timeout outcome 与后续 handle await 都要有断言；不可用 sleep 制造窗口。

## 3. 实现：检验完成顺序

在 sample crate 的测试中用三个 oneshot gate 启动同类型任务，按 ID 2、0、1 的顺序逐个 release 并逐次 `join_next`。补全断言，验证结果按 completion order 输出。若一次 release 多个 gate，只验证返回集合，不断言并列完成的固定顺序。

**契约**：使用 `JoinSet::join_next` 或等价的完成驱动集合；不能顺序 await 全部 JoinHandle 后将 spawn 顺序误报为完成顺序；每个 task 结果必须收集。

**提示**：JoinSet 返回的 result 顺序由哪个事件决定？

**验证**：可控 channel 决定唯一 ready task，重复运行同一 ID release 序列仍得到相同结果。

## 答案与尝试

独立提交前不要读取 M14 私有评分与参考实现。查看提示仍可继续学习，但不能将此次记录为未看答案的独立能力证据。正式评测还会区分平台超时与学员代码失败。
