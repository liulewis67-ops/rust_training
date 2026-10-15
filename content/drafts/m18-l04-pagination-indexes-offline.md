# M18-L04：分页、索引与离线编译检查

## 学完后

- 使用稳定排序键和 keyset cursor 实现可继续读取的分页。
- 为筛选和排序列设计匹配索引，并以查询计划检查数据库是否使用它。
- 用 SQLx query macro metadata 在无数据库连接时检查静态 SQL 与 schema 的匹配。

## 先修

完成 M18-L03，理解 SQLite constraint、事务和原子条件更新。分页与索引示例使用 SQLite 本机数据库；索引选择、查询计划和离线 metadata 应以生产数据库及锁定 SQLx 版本分别验证。

## 排序必须完整且稳定

只按 `name` 排序时，多个标签同名没有确定先后次序。以 `(name, id)` 作为全序键，页边界才能指向唯一位置；唯一 ID 是第二排序键，用于区分同名行。

offset pagination 用 `LIMIT/OFFSET` 容易理解，但在页间发生插入或删除时，偏移位置移动会导致重复或漏行。Keyset pagination 把上一页最后一行的排序键作为 cursor：

```sql
SELECT id, name, created_at
FROM labels
WHERE (name, id) > (?, ?)
ORDER BY name, id
LIMIT ?;
```

新插入但排序键早于 cursor 的记录不会让后续页面向前滑动；cursor 之后的记录仍能继续读取。分页是时间上逐页读取，不自动代表跨页快照；如果需求要求同一个数据库快照，要另行设计事务和生命周期，不要让长事务横跨用户翻页。

校验 page size 在 1 到上限之间，cursor 中的排序值要按同一 collation 和数据类型比较。绑定的 LIMIT 值是数据；ORDER BY 列名不能由普通绑定值替换，需由代码控制有限的固定排序选项。

## 索引匹配查询形状

`CREATE INDEX labels_name_id_idx ON labels(name, id)` 可支持以 name/id 排序并从 cursor 位置继续扫描的查询。复合索引的列顺序很重要：左侧前缀通常决定哪些过滤/排序形状能受益。索引增加写入与磁盘成本，不应只因列存在就全部建索引。

使用 `EXPLAIN QUERY PLAN` 保存关键查询的执行计划，检查它是否扫描预期索引，并观察是否额外排序。查询计划的格式会随 SQLite 版本变化；应验证有意义的索引使用证据，不要把全部字符串输出当成跨版本稳定 API。数据规模、选择性和生产 engine 都会影响选择。

## SQLx offline metadata 与静态查询

SQLx `query!` / `query_as!` 宏可在构建时对照数据库 schema 检查 SQL、列名和类型。`cargo sqlx prepare` 从实际 schema 生成 `.sqlx` metadata；无运行数据库时设置 `SQLX_OFFLINE=true`，宏从该目录读取描述。

Metadata 是特定 SQL 文本与特定 schema 的描述，不是源码本身的替代品。migration 或静态查询改变后要重新 prepare 并审查 metadata diff；CI 的离线检查应使用锁定依赖，并确认提交的 metadata 与当前 migrations/schema 一致。runtime `query_as` 没有这项编译期检查；动态拼出的 SQL 也不能被当成已离线验证的固定查询。

## 本机验证边界

练习使用同名记录测试 keyset 连续页、插入前游记录时不重读 cursor 后记录，并检查 `(name,id)` 索引出现在计划中。query macro offline metadata 由相同 migration schema 生成，然后断开数据库连接执行离线构建。它不证明生产数据分布、PostgreSQL 的 planner 或 R3 构建镜像状态。

## 分层提示

1. **全序提示**：为什么只按非唯一 name 排序不足以标记一个 page boundary？
2. **滑动提示**：两次 OFFSET 查询之间前面插入一行，第二页会发生什么？
3. **cursor 提示**：复合游标 `(name,id)` 如何区分同名行并推进页面？
4. **索引提示**：查询计划怎样证明索引匹配了 predicate 和排序，而不是只证明索引存在？
5. **offline 提示**：静态 SQL 或 migration 改动后，旧 `.sqlx` metadata 为什么不再可靠？
6. **快照提示**：keyset pagination 与跨页一致性快照解决的是同一个问题吗？

## 来源

- [SQLx 0.9.0 `query!`](https://docs.rs/sqlx/0.9.0/sqlx/macro.query.html)：静态 SQL 的编译期检查和 offline metadata。
- [SQLx CLI prepare](https://github.com/launchbadge/sqlx/blob/main/sqlx-cli/README.md)：生成与检查 `.sqlx` 查询 metadata。
- [SQLite Query Planner](https://www.sqlite.org/queryplanner.html)：多列索引和查询计划基本原则。
- [SQLite EXPLAIN QUERY PLAN](https://www.sqlite.org/eqp.html)：读取 SQLite 查询计划。

SQLx 与 SQLite API 按官方文档核对；cursor/插入竞态和原创查询契约用于教学。作者稿不构成生产数据库性能或 R3 环境验收。
