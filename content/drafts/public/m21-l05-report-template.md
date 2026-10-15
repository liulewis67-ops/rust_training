# M21-L05 诊断报告

## 版本与基线

- 课程/Scenario 版本：
- Rust/服务版本与环境类型：
- 基线 ZIP / 输入 hash：
- 时间窗（UTC）：
- 单位与样本来源：
- 注入前状态与恢复检查：

## 症状与证据

| 信号 | 基线 | 注入后 | 干预后 | 时间窗/单位 |
|---|---:|---:|---:|---|
| pool acquire wait p95 | | | | ms |
| query duration p95 | | | | ms |
| queue depth / capacity | | | | items |
| enqueue / dequeue rate | | | | items/s |

## 假设与预测

- 观察（只写可复查事实）：
- 首要假设：
- 如果正确，预期信号变化：
- 替代解释：
- 可反驳首要假设的证据：

## 单变量注入与缓解

- 单一注入/变更：
- 为什么这个变量能区分假设：
- 实测结果：
- 支持/反驳与下一步：
- 未改变的量：

## 回归与恢复

- 新增回归测试及实际命令/输出：
- Injection 已关闭：是 / 否
- DB pool、worker 与 queue baseline 已恢复：是 / 否 / 未执行
- cleanup 证据/资源隔离 ID：
- 原始 starter 与输入 hash 仍匹配：是 / 否

## 结论与限制

- 已确认的事实：
- 仍未证明的根因：
- synthetic/R3 证据边界：
- 后续需要的诊断数据：
