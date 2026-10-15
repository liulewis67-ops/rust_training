# M23-L02：分配、clone、序列化与热点

## 学完后

- 识别 `String`/`Vec` 等拥有堆数据的 clone、字符串转换和容器扩容中可能发生的分配。
- 在行为和生命周期不变的前提下，将只读路径改为借用，并说明返回数据的所有权合同。
- 比较 `serde_json::to_string`、`to_vec` 或 writer 的适用输出，分别测量序列化和端到端 I/O。
- 用 profile 定位真实热点，再用相同输入/结果合同的基准判断修改是否值得保留。

## 先定所有权和输出合同

`String::clone()` 为拥有型字符串复制内容；普通 `&str`、`&Record` 借用现有存储，不复制被指向的文本。容纳 `String` 的记录被 clone 时，字段内容也会被复制。`Rc`/`Arc` clone 则是引用计数操作，成本和语义不同，不能套用同一个“clone 很贵”结论。确实需要独立所有权、跨任务存储或延长生命周期时，clone 是合理选择；只有在 profile/基准指出该路径值得改变，且借用能满足接口和生命周期约束时才移除。

对只读查询，常见接口对比是 `Vec<Record>` 与 `Vec<&Record>`：二者都可能分配结果 Vec，但前者逐记录复制 owned fields，后者保存引用。若调用者最后只需要计数或总和，可能连结果 Vec 都不需要。容量预留也有成本：`Vec::with_capacity(n)` 为至少 n 项预留空间，可降低扩容；命中率很低时按总输入长度预分配却会浪费内存。不要为减少一次分配而复制一份整个集合。

## 序列化选择与边界

Serde JSON 提供 `to_string` 生成 JSON `String`、`to_vec` 生成 JSON bytes、`to_writer` 写入目标 sink。若调用者最终必须返回 `Vec<u8>`，`to_string(...).into_bytes()` 会构造 String 中间表示，值得与 `to_vec` 比较；若目的地是文件或 socket，writer API 可避免先物化完整输出，但会引入 I/O 与 buffering，应该另做端到端测量。序列化结果本身必须相同，且 error/flush/backpressure 合同不能丢掉。

API 看起来少了一次转换，不等于实测必然更快或分配更少。不同 serializer 路径、capacity 策略、数据大小和 escaping 都会影响结果。先做字节相等/round-trip 正确性检查，再用固定 JSON fixture、相同记录与输出消费方式做成对基准；单独基准 JSON 编码时，不把读取文件、网络发送或 workload 创建混进计时区间。

## 找到分配热点

先看 CPU sampling profile 中的 `clone`/allocator/serializer 调用是否处在关键调用路径，再使用 allocation profiler 或带计数的 allocator 确认次数、字节和调用位置。CPU flame graph 中的 allocator 宽度代表被采样的 CPU 栈比例，不是分配字节数；需要 allocation-specific evidence 才能断言谁分配了多少。采样和 allocator instrumentation 都有成本，并可能改变执行特征；记录工具、事件、采样窗口、build flags、工作负载和目标平台。

优化前保存 baseline revision、原始结果和 correctness checks。一次只改一类成本（例如消除拥有型 label clone），复跑同一组数据及排序，记录 p50/p95/throughput 和分配 evidence；若变化小于噪声、降低性能或增加内存峰值/接口复杂度，恢复改动或继续测量。生产结论仍需要 R2/R3 固定 runner。本地 crate 单测只说明 API 结果正确，本机 Criterion 只说明这台机器和该 harness 的观察。

## 练习 crate

本节 starter 有两个教学目标：`has_match` 通过 clone 复制候选记录的 label，`encode_json_direct` 尚未实现。配套 Criterion bench 在同一固定记录集上对照 owned/borrowed 查询和 String/bytes 序列化路径；它不提供预期性能数字，也不假定哪个变体一定更快。练习 crate 的返回值和序列化 byte tests 是 correctness contract，性能差异必须从实际测量结果单独判断。

## 分层提示

1. 一万个记录中只有一个命中；拥有型结果和借用型结果各自会保留哪些数据、需要哪些分配？
2. `String::clone` 可能在哪一步付出成本？如果返回值立即丢弃，它与长时间保存有什么不同？
3. 同一对象调用 `to_string().into_bytes()` 与 `to_vec()`，哪个输出合同是调用者真正需要的？如何证明字节相同？
4. 在 profiler 中看到 `malloc` 栈较宽，能否直接断言此处 alloc bytes 最大？还缺什么证据？
5. 为什么 `Vec::with_capacity(records.len())` 在过滤命中率很低时可能不是正确优化？
6. 改成 `&Record` 后，如果调用方需要在源 records 被 drop 后继续保存结果，怎样处理所有权？要把新的生命周期/内存成本计入哪个合同？

## 来源

- [The Rust Performance Book：Heap Allocations](https://nnethercote.github.io/perf-book/heap-allocations.html)：clone、owned/borrowed、Vec 和分配 profiler 的分析建议。
- [Rust 标准库：Vec](https://doc.rust-lang.org/std/vec/struct.Vec.html)：容量与扩容合同；实现不承诺固定增长策略。
- [Serde JSON：crate guide](https://docs.rs/serde_json/latest/serde_json/)：`to_string`、`to_vec`、`to_writer` 输出 API。
- [Criterion 0.8.2：BenchmarkGroup](https://docs.rs/criterion/0.8.2/criterion/struct.BenchmarkGroup.html)：同组比较和 benchmark 配置。
