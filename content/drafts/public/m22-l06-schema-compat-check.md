# M22-L06 独立检查：旧版本遇到新 schema

## 任务规则

这是未见过的跨版本兼容性变式。收到 attempt 后，先记录课程版本、variant hash、starter/source snapshot 与 runner/evaluator 版本；独立完成提交前不得查看 rubric 或参考答案。公开 variant 是练习夹具，不能冒充真实数据库事故。正式技能评估必须通过获授权的 R2/R3 runner 获得本次 attempt 的 migration、artifact、replica、probe、traffic 和 cleanup 事件。

## 场景

打开 `m22-l06-schema-compat-variant.json`。数据库已处于 schema 42，`legacy_name` 已被移除。两个 v3.8.0 副本在服务；另有一个被 rollout controller 漏掉的 v3.4.2 进程仍被管理器追踪。该旧版本查询 `legacy_name`，收到 PostgreSQL SQLSTATE 42703 后未 Ready。路由层目前将它排除，健康副本仍在服务。contract 后已有 27 次 `display_name` 写入；最近一次已核验备份为四小时前，声明 RPO 是 15 分钟。

正式 runner 的现场观测若与夹具不同，以 attempt 原始事件为准，并在报告中指出差异。runner 不可用、资源不隔离或事件缺失时，停止正式演练，提交 `platform_blocked`；不要用夹具填补 live evidence。

## 独立提交

提交一份简短事故报告，至少包含：

1. 用表格列出旧/当前应用版本支持的 schema 范围，并标出实际部署组合的不兼容边。
2. 由迁移 receipt、旧版本查询、SQLSTATE、readiness 与流量事件还原故障链；区分旧副本探针失败和用户请求错误。
3. 给出当前 10 分钟的止损步骤，注明流量门、健康副本、停止晋升/回滚目标和证据收集，不触碰生产资源。
4. 选择向前修复、应用回滚或 schema/data 恢复中的路径，解释为何其他路径不满足兼容性、数据完整性或 RPO；选定恢复动作后核对 artifact digest、schema version、readiness、服务版本及业务数据不变量。
5. 写明失败时的停止条件、恢复后复核、attempt reset/cleanup，以及一个防止下次过早 contract 的发布门。
6. 附 source/artifact/migration/revision 的不可变标识、每个副本的 readiness 与版本、流量观测和 runner cleanup receipt。报告只引用事件 ID/摘要，不能包含秘密。

## 通过条件

旧 artifact 与 schema 的兼容关系准确；止损保留健康版本；恢复选择能在当前 schema 上运行的已固定 artifact，或给出有数据证明的恢复方案；没有把重新构建旧源码称作原 artifact 回滚；验证覆盖探针、实际服务版本和数据不变量；最终 teardown 有平台回执。

## 提交与反馈

首次独立提交由 evaluator 根据公开报告结构和私有合同判定。反馈返回稳定代码，指出需要补的证据或不成立的恢复假设；允许查看反馈后再次练习，但重试、已查看答案或平台错误都不能生成独立技能证据。平台/evaluator 故障记录为 `platform_error`，不作为能力失败。

## 证据边界

静态兼容矩阵、人工推演、课程夹具、单元测试和截图都不能证明真实应用/schema 兼容。课程作者没有运行该夹具的 PostgreSQL migration、部署、故障复现、恢复或 cleanup。正式结果必须有 runner 事件、真实 attempt 快照和独立提交记录。

## 来源

- [PostgreSQL 18：ALTER TABLE](https://www.postgresql.org/docs/18/sql-altertable.html)：列出 `DROP COLUMN` 的对象依赖和 DDL 行为。
- [PostgreSQL 18：Dependency Tracking](https://www.postgresql.org/docs/18/ddl-depend.html)：解释数据库对象依赖关系与 DROP 的默认依赖保护。
