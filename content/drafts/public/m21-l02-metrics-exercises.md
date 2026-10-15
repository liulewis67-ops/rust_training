# M21-L02：三道短练习

## 1. 预测：哪些事件计入哪个 SLI？

目标窗口为 `[100, 200)`。API 契约把成功响应与预期 `404 resource_not_found` 都视为 good；`500` 为坏事件。Runner 成功交付输出，即使输出代表编译错误，也算平台 good；启动器故障算平台坏事件。预测下面事件后的两个 SLI 计数，并判断目标 `990_000 ppm` 是否满足。

```text
API 100 success
API 199 resource_not_found
API 200 server_error
Runner 101 learner_compile_error
Runner 180 platform_unavailable
```

**契约**：时间戳 200 不属于窗口；API SLI 与 runner SLI 独立；没有可用样本时必须报告无数据。

## 2. 修复：结果误分类与无界标签

starter 把所有非 2xx API 结果和所有非成功学习者结果都计为平台故障，并把 `request_id` 与原始 path 放入标签。修改使 API 业务拒绝按声明合同处理，学生代码失败与 runner 故障分开；维度只允许 route template 和有限 outcome enum。

**提示**：检查窗口聚合的分子和分母、半开区间边界以及真实暴露的 label keys；仅改 metric 名称不够。

## 3. 实现：两个可解释的窗口 SLI

实现纯 Rust 窗口汇总和目标判断：`[start, end)`、百万分比整数目标、空窗口为 `None`；API 与执行平台分别汇总。编译失败/测试失败证明 runner 正常交付，不能吞进平台错误预算。为 SLI 使用稳定 route enum 与有限结果标签。

**提示**：用整数交叉乘法比较目标；先将 outcome 拆成 API 与 runner 的类型，避免一个泛化 `failed: bool` 丢失失败归属。
