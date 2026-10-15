# M24-L05 实验：P4 服务交付包

## 实验目标

你将维护一个已有 Rust 服务，从固定源码快照组织一份可复查的 P4 交付包。实验用的服务与证据均为合成内容；重点是把代码、测试、运行、恢复、性能和增量维护证据连到相同的项目 revision。

## 交付物与依赖

| P4 里程碑 | 交付内容 | 必须可追踪到 |
|---|---|---|
| P4.1 可重现交付 | 源码 revision、lock/build/target/runtime/config/release说明 | I12-F04 的环境和产物合同 |
| P4.2 运维交付 | 日志/指标/health、操作说明、排障步骤 | M24-L02 runbook 与运维场景 |
| P4.3 恢复交付 | 迁移兼容、应用回滚、数据恢复步骤与记录 | I12-F06 的真实恢复证据合同 |
| P4.4 性能证据 | 相同 workload 的 correctness、原始重复样本、profile、适用边界 | M23-L01–L06 和 I12-F07 |
| P4.5 毕业维护 | 陌生需求、review/测试/说明、评审版本和决定 | M24-L01–L04 与 I12-F08 |

一份证据只能支持它实际测量的主张。例如，ZIP hash 能证明打包文件字节，不证明 Linux 镜像启动；迁移计划不证明数据恢复成功；一条最佳耗时不证明可重复性能收益。每个 artifact 绑定 source revision/hash、环境/工具版本、时间和 evidence IDs；报告明确没有执行的验证。

## 过程

1. 从 `delivery-manifest.json` 起始模板创建新副本，记录项目代号、固定 revision 和锁文件 hash。不得引用个人本机配置、私有凭据或不允许共享的客户数据。
2. 对照五个 P4 里程碑填充 artifact hash 与 evidence IDs。若某条真实 runner/容器/服务证据没有执行，明确标记 `not_run` 并说明所需前置，不能伪造成功收据。
3. 用公开合同检查清单结构完整性，修复 starter 缺陷。公开检查只验证 manifest 结构、ID 唯一性和哈希格式，不连接 Docker、数据库、负载生成器、R2/R3 runner，也不核验引用证据真实性。
4. 阅读 `fixtures/incomplete-delivery.json`：它宣称恢复与性能通过，却缺真实步骤和重复样本。拒绝或标记主张不受证据支持，并写出重置办法。
5. 保存最终 manifest、源 revision、修复 diff、debug/release 检查摘要、私有验收 attempt 和重置记录。不得把未运行环境的错误包装成 learner failure。

## 完成合同

- 五个里程碑恰有一条记录，项目与源码 revision 非空。
- 每条 evidence artifact 具有 SHA-256 格式哈希与至少一个可定位 evidence ID；没有证据的交付标 `not_run` 并不得记通过。
- 性能主张同时指向功能合同证据和测量证据；真实测量必须在同一固定目标/负载下保留多次原始样本和 profile。报告可以诚实结论“未证明改善”。
- 恢复主张分别标注应用回滚和数据/schema 恢复；只有计划而无执行记录时不得记恢复通过。
- 练习包可清洁重置，不携带答案、密钥或之前学员状态。

## 复位

删除当前练习副本及本地生成结果，从清洁 ZIP 重新解压；确认包中没有本次 attempt、答案、私人环境文件或受忽略构建输出。保留只读的起始 manifest hash 以证明重置来源。复位成功只证明工作区干净，不代表所有运行环境已 teardown。

## 来源与边界

本实验将 I12 的 P4.1–P4.5 交付合同汇总成新场景。样例 revision、服务指标和 artifact ID 均为虚构；课程材料与 Rust 本地合同测试不能替代 I12-F04–F08 的实际环境验收。
