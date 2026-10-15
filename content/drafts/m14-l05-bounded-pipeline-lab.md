# M14-L05 实验：有界任务处理流水线

## 目标

实现一个可解释的单进程任务流水线：bounded mpsc 接收工作项，固定数量的 worker 消费，共享 Semaphore 限制活动处理数，结果通过有界 channel 交还给 collector。验证慢消费者造成的背压、任务结果完整性和并发峰值。该实验练习 M14-L01–L04 的句柄、channel、gate、permit 与队列预算，不定义完整服务停机协议。

## 场景与约束

任务有唯一 `id`，每项等待自己的 oneshot release gate 后才完成。测试可控地阻塞工作，不用 sleep 猜 worker 顺序。起始样例队列容量为 1、worker 数为 1、active limit 为 1；变式提高 worker 数到 3、active limit 保持 2。

1. 使用有限容量的工作队列，`try_send` 的 Full 必须把整个 Job 还给调用方；消息发送前必须保留 gate sender。
2. 使用固定 worker 集合并共享同一个 `Arc<Semaphore>`；每个 worker 在 gate 完成前持有 OwnedSemaphorePermit。
3. 每个成功 Job 恰好向结果队列交付一次 id；错误或 receiver 关闭时必须有明确处理路径。
4. 结果 channel 也必须有界。collector 变慢时 worker 可背压，但需保证测试同时推进 collector，避免把测试自身设计成死锁。
5. 任意时刻活动 worker 不超过 active limit；队列中等待任务数不超过 queue capacity；不要在 worker 之外先为每个请求无界 spawn。

## 实验步骤

1. 从 ZIP / 起始目录复制 `m14-l05-pipeline-lab` 到临时练习目录。记录 Cargo.lock SHA 和 starter 快照 SHA。
2. 运行 `cargo fmt --all -- --check`、`cargo check --locked`、`cargo test --locked`、`cargo clippy --locked --all-targets -- -D warnings` 与 `cargo doc --locked --no-deps`，先保存起始失败。
3. 读 `src/lib.rs`，标出 queue capacity、worker count、active permit 和结果发送的位置。记录峰值和所有权，不根据源代码猜测运行顺序。
4. 完成两项公开检查：单 worker 下把队列填满并验证 Full 可回收，释放 gate 后继续处理且结果全部到达；三 worker 下配置 active=2，用 started gate 验证第三项必须等 permit。
5. 至少提交一个故障方案给私有评测：使用 per-worker semaphore、丢弃结果，或用 unbounded channel 替换有界等待队列；确认检查能分别检出并说明资源风险。
6. 重复运行公开检查至少 10 次。所有结论必须由 channel gate / 计数 / 队列状态决定，不以时间阈值或默认 scheduler 顺序为依据。

## 重置与提交快照

每次尝试从原始 starter 重新复制练习目录，不复用修改后的 target 目录。保存 `git diff --binary` 或课程平台提交快照、lesson/starter lockfile hashes、Rust/Cargo 版本、完整命令输出、失败原因和重跑次数。reset 只删除临时副本，保留原始 starter 和本地记录。不要把私有参考 crate、私有评测或评分答案放入公开提交。

## 完成证据

作者侧样例结果不算独立学习者成绩。正式实验还要求 R2 隔离执行、ZIP 重置重验、错误方案检出、独立学习者从未见答案起始快照完成，以及课程平台记录提交快照/答案哈希/评测器版本。作者稿尚未通过这些正式验收。
