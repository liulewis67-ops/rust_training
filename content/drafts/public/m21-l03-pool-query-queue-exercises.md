# M21-L03：三道短练习

## 1. 预测：两个高延迟样本的证据有何不同？

样本 A：acquire wait p95=240 ms、query p95=18 ms、池 16/16 个连接在用、队列 2/100。样本 B：acquire wait p95=8 ms、query p95=900 ms、池 5/16 个连接在用、队列 3/100。预测 fixture 会提出哪些 finding，并各列出一个替代解释。

**契约**：A 支持 pool pressure；B 支持 slow query；不能把“支持”写成已证实根因。

## 2. 修复：只报告一个原因

starter 的 classifier 使用 `if/else`，一个快照最多返回一个 finding。池等待、查询 p95 与队列高水位可同时出现，后续检查会因此丢掉信号。修复为独立规则累积 findings；零容量队列不能因除零或默认阈值误报堆积。

**提示**：顺序执行三个独立 predicate；每一个都只消费与其相关的计数和阈值。

## 3. 实现：可证伪的排障快照

实现 pool pressure、slow query、queue backlog 三种 evidence finding：等待 p95 ≥50ms 且连接池使用数达到非零上限；查询 p95 ≥250ms；队列深度达到固定容量的 80%。测试分别覆盖三个单项、三项并发及健康/零容量边界。

**提示**：`capacity=0` 不产生队列 finding；达到阈值用整数交叉乘法。输出 findings 是排查线索，而不是根因标签或生产遥测。
