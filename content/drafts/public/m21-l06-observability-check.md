# M21-L06 独立检查：P3 交付与故障报告

## 规则

这是未见过的 artifact delivery 变式，不依赖 M21-L05 的 pool/query/queue 三张场景卡。开始前从公开 starter 解压到新目录，记录课程、starter 和 evaluator 版本；不要打开答案或私有 rubric。按 starter 中唯一的 `variant.json` 写独立报告并提交。检查失败会返回反馈码，允许看过反馈后重新练习；看过参考答案或非首次通过不生成独立技能证据。评测平台自身错误返回 `platform_error`，不把该次记作技能失败。

## 任务

阅读固定窗口 `[10:00, 10:15)` 内 API / runner / worker signals，完成以下交付：

1. 分别计算 API availability 和 runner availability 的 good、eligible 和 ppm；比较各自 SLO。
2. 解释 `202 Accepted` 的含义，区分 API 接收任务与后台任务终态。
3. 将 5 个学习者代码拒绝和 2 个执行平台失败分类；解释它们对各 SLI 的不同影响。
4. 根据 queue depth/capacity、enqueue/dequeue rate 与 worker utilization，提出一个可反驳的队列假设；说明缺少哪些证据才能确认根因。
5. 分开给 metric labels 与受控 trace/log fields；不得将 request/user/task ID 放入 metric dimensions。
6. 写出一个单变量、安全的验证/回滚步骤和下一条回归测试，并列出若预测不成立的反证路径。

## 报告格式

使用 starter 的 `submission-template.md`。计数必须包含明确分母、时间范围、事件类别和单位；分析必须区分观察、假设、验证与结论。可从 route template、有限 outcome、status class 等有界维度进行查询，不复制样例 request ID 到 metrics。

## 结果与技能证据

总分 10。SLO 计数和归属 4 分、202/runner 生命周期 1 分、队列证据与可证伪假设 2 分、信号字段边界 1 分、实验/回归/复位方案 2 分。将学习者代码拒绝计入平台故障、混合 API/runner 分母、把 request_id 当 metric label、或把 202 当任务成功均为硬失败，文档文字不能抵消。

只有 evaluator 状态 ready、首次独立作答、未查看答案、硬门槛通过且总分达 8/10 时，才能记录 `reliability.observability-diagnosis` 独立技能证据。后续练习、自报、作者侧检查和平台错误均不记技能增长。受控 R3 平台需自己绑定 immutable starter/test/evaluator hash；此草案 schema 不包含真实 learner result。

## 本地边界

此作者侧包只验证课程依赖、JSON/Schema 可解析、starter manifest 与评分规则自洽；没有真实 evaluator、安全运行器或提交历史，不能将作者检查的分数、截屏或该文档转成学生能力记录。M21-L05 真实故障实验和全模块 R3 检查仍需正式环境。
