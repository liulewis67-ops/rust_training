# M22-L04：三道短练习

## 1. 修复：一次发布里删旧列

服务原来只写 `display_name`。提交把 schema 改为立即 `DROP COLUMN display_name`、应用改为只读 `full_name`，并声称“失败时回滚 migration 即可”。改写为按 expand、兼容双写、backfill、核验、switch、关闭 app rollback window、contract 的多阶段计划；标出每个阶段仍可运行的旧/新 app 版本。

**契约**：不能在旧副本还运行时删旧列；明确双写冲突规则、可重复 backfill、切换门槛；说明 drop 后恢复旧值需要数据来源。

## 2. 实现：迁移计划顺序 validator

补全 starter `MigrationPlan::validate()`：各阶段必须恰好出现一次并按安全顺序执行；缺少兼容部署、回填核验，或在关闭应用回滚窗口前 contract 都要给出稳定错误。

**契约**：validator 仅检查计划步骤，不宣称 SQL 在某个数据库版本无锁、安全、已回退或数据已恢复。

## 3. 设计评审：失败发生在 contract 之后

新版本已切换读取并删除旧列；新版本随后出现计算错误。评审两个独立提案：“切回旧 image”与“从 10 分钟前备份整体覆盖生产库”。为每项写兼容性/数据影响、额外证据、可接受的 roll-forward 或恢复动作和决策门。

**契约**：指出旧 image 可能不兼容当前 schema；指出备份覆盖会丢失恢复点之后写入，并需校验备份/WAL、恢复隔离环境、对账差异与 RPO/RTO。不得把任何提案无条件判定为安全。
