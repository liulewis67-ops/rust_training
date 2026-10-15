# M23-L01 三道短练习

## 预测：这些数据支持什么结论？

同一代码版本运行三次：A 为 8.1、8.2、15.7 ms；B 为 8.0、8.3、8.4 ms。每个版本只有一次进程运行中的三批测量，记录没有说明机器负载，执行次序是 A-A-A 后 B-B-B。判断能否宣布 B 更快；写出一条可反驳的解释和下一轮最小对照方案。不要擅自删掉 15.7 ms。

**契约：**区分观测和假设；指出重复粒度/执行顺序或环境缺失；设计控制 workload、环境与 A/B 顺序的重测，并预先写明什么结果会推翻当前假设。

**提示：**先列每个数的单位和独立样本含义。若 15.7 ms 对应真实慢路径，它不是噪声；若是邻居任务，也要有证据说明。

## 修复：nearest-rank p95

在 `m23-l01-sample-summary-starter` 中修复分布摘要代码。合同规定空样本返回稳定错误，偶数样本 median 对中间两值取整数下取整均值，p95 使用排序后的 `ceil(0.95*n)` 个样本（1-based），mean 使用整数下取整。不得丢弃或改写输入样本。

**公开检查：**空样本、单样本、偶数 median、20 个有序样本的 p95（应为第 19 个值）和乱序输入排序结果。

**提示：**nearest-rank 的第 k 项要先算 1-based rank，再减 1 作为数组 index；不要用 floor(n*0.95) 直接当 index。

## 实现：可追溯的 benchmark report

实现 `RunMetadata::validate(actual_sample_count)`，校验 benchmark/workload ID、源码 revision、rustc、profile、target、build flags、features、Cargo.lock 与 fixture SHA-256、CPU/OS、warmup 数和 measured sample 数；至少 3 轮预热、至少 5 个 measured batches、profile 必须是 `bench` 或 `release`，报告样本数必须与实际样本数组长度一致。返回稳定、可定位的错误类别。3/5 是本练习的数据质量合同，不是普适统计充分性保证。

**公开检查：**合法 release 报告通过；debug profile、缺字段、非 64 位小写 fixture/lock hash、预热不足、样本不足和申报样本数不匹配分别被拒绝。代码不能将空输入包装成成功的 0 ns。

**提示：**验证元数据合同不等于验证 benchmark 统计有效。错误值里指出字段名；保留原始失败字段，不回退成“unknown”后通过。
