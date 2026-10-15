# M22-L04：数据迁移、回滚与兼容窗口

## 学完后

- 用 expand/backfill/switch/contract 分阶段改变线上 schema 与应用，不把单次 DDL 当作完整发布计划。
- 说明升级期间旧应用、新应用和扩展后 schema 的兼容关系，定义何时仍可回退应用版本。
- 将应用回滚与 schema/data 恢复作为不同动作；对删列等不可逆或数据丢失操作准备 roll-forward、备份恢复和数据核验策略。

## 先修与边界

先修 M18 SQLx/schema migrations 与 M22-L03 CI、readiness、滚动替换概念。正式执行前置 M22-L03 与 I12-F08 尚未完成。本课的 migration planner 是纯 Rust 序列合同，只接受合成步骤；不运行 PostgreSQL、SQLx migration、备份恢复或线上兼容测试。

## Expand and contract

一个字段重命名可以跨多个版本完成，而不在仍运行旧二进制时直接 rename/drop：

1. **Expand**：新增兼容字段/表/索引，旧 schema 保留；新对象先允许旧版本忽略。
2. **Deploy compatible code**：部署能读旧值并双写新旧表示的中间版本。必须考虑滚动期间旧、新进程同时写入的并发语义。
3. **Backfill**：用有界批次填充历史数据，设计重跑幂等、进度检查、限速和失败续跑；不要持一个大事务锁住整个业务表。
4. **Verify**：比较行数、空值、校验和或领域不变量，确认双写/回填差异已收敛。校验失败时不切换读取。
5. **Switch reads**：部署读取新字段的版本，保留旧写入兼容；观察错误率、数据差异和旧版本副本是否退出。
6. **Close application rollback window**：明确最后一个仍能与旧 schema 配合的二进制何时退休，确认告警窗口和备份/恢复证据。
7. **Contract**：单独的后续迁移才删除旧字段/约束/表。破坏性步骤应在兼容窗口关闭后执行。

步骤要按真实 schema、读写流量、数据规模、锁行为与部署方式调整。PostgreSQL `ALTER TABLE` 不同子命令获取的锁级别可能不同；即便 SQL 很短，也不能据此推断对表无阻塞。DDL 是否事务化、索引创建策略、backfill 速率与锁等待需要对目标版本和数据量实测。

## 两种回滚，不共用一个按钮

**应用回滚**是把服务二进制切回兼容版本。contract 删除旧列后，依赖旧列的旧二进制可能无法启动或读写，故“镜像能切回”不等于“应用可回滚”。回滚窗口必须明确指向一个能使用当前 schema 的 artifact，记录版本、数据库兼容下界和回滚触发条件。

**schema/data 恢复**用于数据库结构或数据已破坏/丢失。可选动作取决于失败阶段：撤销尚未应用的兼容应用；修复后 roll forward；从备份恢复到隔离数据库并核对数据；或按恢复点重放 WAL。恢复通常有 RPO/RTO、写入冻结、恢复点之后数据处理与整库一致性影响，不能用一次 `ALTER TABLE` 反向写法代替。

例如 `DROP COLUMN old_name` 后，PostgreSQL 不会让后续 `ADD COLUMN old_name` 自动恢复已删数据；必须重新填值、从备份/PITR恢复或从业务源重建。即使数据库文件还保留物理空间也不构成可查询、可依赖的数据恢复合同。不可逆迁移应标为 contract/forward-only，并在执行前完成备份可用性和恢复演练。

## 迁移发布表

| 阶段 | 当前应用版本 | 兼容要求 | 可用恢复路线 |
|---|---|---|---|
| Expand | 旧版本 | 新对象可忽略；旧字段仍有效 | 应用回退通常仍可行；保留新增 DDL 也可能安全 |
| 双写/回填 | 混合旧版与兼容版 | 新旧值规则一致；操作幂等且有进度 | 回到兼容旧版；停止批处理并诊断差异 |
| Switch reads | 新读路径、旧字段仍存在 | 回滚 artifact 必须仍能读当前 schema | 窗口内切回双读/兼容版本；数据按合同继续双写 |
| Contract | 仅新版本 | 旧 artifact 可能已经不兼容 | forward fix 或从独立备份/PITR 恢复；不是简单应用回滚 |

每次计划写明 migration ID/hash、数据库版本、旧/新应用 commit、开始/完成时间、锁和数据规模、分批 checkpoint、校验查询、失败停止点、应用回滚目标、schema 恢复点、RPO/RTO、操作者与最终核验。执行过的 migration 文件不可修改；修正错误要增加新 migration，防止不同环境历史漂移。

## 分层提示

1. 为什么先加新列、再兼容写入、回填核验、切换读取，最后才能删旧列？
2. 部署新旧副本共存时，只有新版写新列会产生什么缺口？
3. schema 破坏操作之后，旧镜像能回滚是否充分？请写出一项应用恢复和一项数据恢复证据。
4. 重新创建已删除列为什么不等价于恢复原值？
5. 长批次 backfill 需要限制哪些资源，并如何从中断点续跑？
6. PostgreSQL `ALTER TABLE` 的锁能否仅凭语句长度判断？需要检查哪些目标版本/DDL因素？

## 来源

- [PostgreSQL：ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)：子命令、锁级别差异、DROP COLUMN 和约束行为。
- [PostgreSQL：Backup and Restore](https://www.postgresql.org/docs/current/backup.html)：SQL dump、文件系统备份和连续归档三类备份方式。
- [PostgreSQL：Continuous Archiving and Point-in-Time Recovery](https://www.postgresql.org/docs/current/continuous-archiving.html)：base backup 与 WAL 重放恢复到时间点的边界和准备条件。

作者侧仅验证 planner 对合成步骤的顺序合同；没有查询目标 PostgreSQL schema、执行 migration/backfill、测锁或恢复备份。真实兼容、应用回滚和 data restore 证据仍待 R2/R3 实验环境验收。
