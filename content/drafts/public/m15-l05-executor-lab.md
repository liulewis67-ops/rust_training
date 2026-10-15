# M15-L05 实验：P2 任务执行器

## 目标

完成一个本地模拟的 P2 executor：有限容量的输入与结果 channel、固定 worker 集合、共享并发上限、每项单一终态、取消和超时分类、失败可重试/永久分类、停止接单后排空并收集 worker 结果。此起始包把执行事件全部放在 oneshot gate 中，不需要网络、数据库或 Linux 容器。

## 约束与不变量

1. 输入队列、结果队列都有限；`try_send` 返回 Full 时完整 Job 归 producer 所有。
2. 一个共享 Semaphore 限制运行/等待受保护工作段的活动数；固定 worker 数，不为每项 job 另 spawn waiter。
3. 每个接收并正常处理的 job ID 恰好产生一个 Terminal：Succeeded、RetryableFailure、PermanentFailure、Cancelled、TimedOut。不要把取消或超时报告成成功。
4. 工作、取消和开始/出队观察都用 oneshot gate；测试保持 collector 存活直到 worker 全部 join。
5. 关闭输入 sender 表示停止接单；已接收及队列中的工作继续 drain 到终态。超时从 worker 出队时开始，避免不断重置预算。
6. RetryableFailure 只分类，不自动重试；真实 retry policy 必须限制次数并重新经过队列/预算。

## 实验步骤

1. 解压 `m15-l05-executor-starter.zip` 到全新临时目录。对照 manifest 核对所有公开文件，记录 SHA、Rust/Cargo/Tokio 版本和原始快照。
2. 执行 fmt、`cargo check --locked`、`cargo test --locked`、严格 Clippy 与 Rustdoc，保存预期失败。
3. 读 `src/lib.rs`，标出 bounded queue、shared permit、per-job deadline、取消分支、失败映射和 terminal sender。
4. 修复三项故障：每 worker 独立 semaphore、取消误报成功、timeout 误报成功；不得删改 contract tests 或缩减错误输入。
5. 跑公开测试：Full payload 可回收、第二个任务在唯一 permit 释放前不能开始、取消/timeout/retryable/permanent 四种结果可区分、关闭 sender 后 worker 退出且已接受任务恰好各有一个报告。
6. 提交一个错误变体（本地 semaphore、取消变成功、超时变成功、无界 channel）并记下哪个契约失败，说明为何不允许该资源行为。
7. 完成后保留 diff/snapshot SHA 与工具链记录；从原始 ZIP 新副本执行 reset，确认 manifest 不变，再次运行完整检查至少 10 次并保存命令结果。

## 重置与交付

只删除临时副本，然后从未修改的 v0.1.0 ZIP 解压新副本。不要在原始包上改代码，不复用旧 `target/`，不要把私有参考 crate 或评分规则加入公开 ZIP。提交快照应绑定 starter ZIP SHA、manifest、修改后 tree SHA、Cargo.lock SHA、验证器版本、命令输出和失败分类。

## 作者侧边界

公开 starter / 错误基线只验证题目是否能检测缺陷；私有参考解在 Windows 验证不等于 Linux/R2 验收。正式实验还需 I06/I07 前置、R2 隔离运行、版本化快照和未看答案的独立学习者完成。
