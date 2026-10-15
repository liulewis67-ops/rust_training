# M18-L06 独立检查：并发版本冲突与转账回滚

## 检查任务

在一个小型账户存储 crate 中修复两项数据库不变量。先从全新 starter ZIP 开始，不看私有 rubric/reference。公开接口接受调用方读取到的账户 version；同一 version 的两个 writer 竞争时只能有一个提交。转账的任一步骤失败都不得留下部分余额变化。

## 公开检查

1. 两个并发请求都基于 account 7 的 version `0`，各取款 `100`。恰好一个结果是 `Applied`，另一个是 `Conflict`；最终余额 `200`，version `1`。
2. 从 account 10 转出 `125` 到不存在的 account 99，返回 `MissingDestination`；来源余额必须仍为 `500`。

公开结果只能由数据库写入与查询推出。固定返回 `Applied`、只更新内存对象、忽略 version 或在目的账户检查前提交，都不能通过。

## 工作规则

1. 从 `m18-l06-concurrency-check-starter.zip` 解压到新目录，记录锁文件和 manifest；运行 `cargo test` 留存公开基线。
2. 阅读 `withdraw` 和 `transfer`，说明条件更新应如何消费 expected version，以及两次余额更新如何共享事务边界。
3. 修复实现并运行公开检查、格式检查、严格 Clippy 和 Rustdoc。另加一个陌生 amount 或 missing-source 变式，并记录预期状态。
4. 再从全新 ZIP 解压，确认故障可重现；独立修复第二份工作区并记录版本和结果。不得把看过参考解的修复冒充独立技能提交。

## 失败反馈

- 两次取款都成功：把 version 条件放入同一条 `UPDATE`，不要先读再无条件写。
- 余额变成 `100` 或 version 增加两次：检查更新谓词是否包含客户端读取到的版本。
- 目的账户缺失后源余额减少：目的账户 credit 和源账户 debit 必须在同一事务；失败分支 rollback 后才返回领域结果。
- 并发用例遇到 SQL/环境错误：先记录数据库与 pool 配置，区分平台故障和违反契约，不要将错误吞掉改成成功。

本稿及作者侧自测不是独立学习者技能证据。正式 A 门槛需要 R3 受控运行、未看答案的独立提交、快照版本追溯和平台评分记录。
