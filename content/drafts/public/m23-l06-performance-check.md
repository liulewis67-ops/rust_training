# M23-L06 独立检查：在固定环境证明改进且功能未回退

这是一次独立检查，不提供本次隐藏变式、原始测量、profile 或答案。你需要在 evaluator ready 后按说明完成首次提交；看到答案、runner/evaluator 中断或重试都不产生技能证据。

## 提交内容

1. 带 source revision、锁文件/fixture hash、toolchain/target、release flags、runner 和 workload 版本的 baseline 与 candidate。
2. 修改前后的原始重复样本、采样 profile 原件和相同 workload 的报告；注明指标、窗口、warmup、负载模型、尾延迟样本合同及误差/变异。
3. correctness regression、边界测试和失败方案；证明 API/数据语义未回退，并注明如果结果在噪声内或性能变差如何决策。
4. 对未知 workload 的适用范围、资源/内存代价和回滚条件说明。
5. evaluator attempt ID、提交 hash、runner cleanup receipt 与原始 profile/report hash。

## 判定规则

- 不以一条最佳时间、仅有平均值、或未核验的本机数字作为性能证明。
- baseline 与 candidate 必须来自同一固定 runner、同一目标、相同输入/工作量和可比较的构建设置；fixture/hash 或协议变化时必须重跑并解释。
- 正确性、完成吞吐、错误/超时、p95/p99、pending/队列及必要的资源指标各自按合同解释。优化有回归、区间无法区分或对隐藏变式不成立时，可以结论为“未证明改进”，不能硬报通过。
- 技能证据只在 evaluator ready、首次独立提交、没有查看答案、门槛全通过且 runner 清理成功时记录。平台故障、重复尝试、答案已查看或仅作者侧测量都不发技能结论。

## 评测输出合同

生成的 attempt 记录应匹配同目录的公开 JSON Schema。反馈只指出下一步要补的证据或正确性问题，不泄露隐藏数据与参考答案。平台/evaluator 错误返回可重试状态且不降低学习者能力状态。
