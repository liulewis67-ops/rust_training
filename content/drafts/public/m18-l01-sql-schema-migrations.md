# M18-L01：SQL、schema、迁移与数据库种子

## 学完后

- 将领域字段、不变量、主键与关系约束落实为可审查的 schema migration。
- 区分数据库 schema migration 和可重复执行的数据 seed/fixture。
- 在全新本地数据库应用迁移和种子，重复运行时保持稳定，并让不兼容旧 schema 失败且留诊断。

## 先修

完成 M17-L06 的 extractor/middleware 检查草案，知道 HTTP 错误和服务错误边界。真实 pool、SQL 参数绑定与结果映射分别在 M18-L02 展开；事务/并发更新在 M18-L03。此处用 SQLx SQLite 内存数据库验证迁移逻辑，不连接 Linux 容器或外部数据库。

## 先定义不变量，再写 schema

先写出表的身份、必需值、唯一性和关系。样例 Label 有稳定文本 ID、不可空 name、name 不能全空白、创建时间由数据库填入。数据库约束是所有写入路径共用的最后防线；Rust handler 的验证用于更早地返回友好错误，不能替代存储层不变量。

```sql
CREATE TABLE labels (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

主键定义身份并阻止重复；NOT NULL、CHECK 与 DEFAULT 明确不同的规则。SQLite 有自己的类型亲和与主键细节，其他生产数据库的 DDL/约束语义要在目标引擎上核对，不能把 SQLite 本机实验当作 PostgreSQL 等价验收。

## migration 是版本历史，不是随手初始化脚本

每个迁移文件代表一次有序 schema 变化，由 Migrator 记录成功版本。已经应用到共享环境的 migration 应视为不可变历史；后续 schema 改动新增版本，而不是静默编辑旧版本。空数据库测试要从零应用整组 migration；重复调用 migration runner 则验证版本账本阻止同一迁移再次执行。

SQLx `migrate!` 把指定 migrations 目录嵌入程序；目录相对 Cargo.toml 所在 crate root。stable Rust 的 build script 应声明对 migrations 目录的变更关注，避免只改 SQL 后构建系统漏掉重新编译。迁移运行时对 DDL 事务的支持与失败原子性按数据库引擎核对，不假定所有 backend 相同。

## seed 和测试 fixture 有不同用途

Seed 是让开发/演示环境拥有稳定基础数据的版本化初始化策略；应明确是 insert-once、upsert 还是清库重建。本练习使用固定 ID，并用冲突策略使重复 seed 不新增副本。fixture 则是单个测试需要的组合数据，生命周期随测试隔离，不自动变成生产业务种子。

数据库引擎会检查 NOT NULL、主键和 CHECK 等约束。测试应运行真实 SQL，不只断言 Rust struct 包含某个字段。坏 schema 变式在 migration 之前预先建立不兼容同名表；预期迁移失败，报告可供诊断，不能悄悄标记版本成功。

## 本机验证边界

起始 crate 使用固定 SQLx 0.9.0 和 SQLite bundled driver，以单连接内存 pool 隔离测试。它能验证当前 SQL 文件、迁移账本、seed conflict 和 SQLite 约束；它不能证明 R3 容器网络、目标生产数据库方言、真实备份恢复或跨数据库迁移策略。

## 分层提示

1. **schema 提示**：ID 是身份还是可变显示值？哪条约束阻止空名称流入数据库？
2. **migration 提示**：为什么改动已经共享应用的 SQL 文件可能让迁移 hash/历史失配？
3. **seed 提示**：重复执行同一 seed 是报错、跳过还是更新？这个策略符合数据所有权吗？
4. **引擎提示**：SQLite 测试证明了什么，又没有证明 PostgreSQL 上什么？
5. **失败提示**：同名但不兼容的表存在时，如何证明迁移失败没有被记录为成功？
6. **目录提示**：`migrate!` 的路径相对哪个项目目录？只改 migration SQL 时如何触发重新构建？

## 来源

- [SQLx 0.9.0 migrate!](https://docs.rs/sqlx/0.9.0/sqlx/macro.migrate.html)：嵌入迁移目录、路径基准与 build-script 重新构建提示。
- [SQLx 0.9.0 Migrator](https://docs.rs/sqlx/0.9.0/sqlx/migrate/struct.Migrator.html)：版本化 migration set 与运行 API。
- [SQLite CREATE TABLE](https://www.sqlite.org/lang_createtable.html)：主键、NOT NULL、UNIQUE 和 CHECK 约束语义。

SQLx 版本和 migration API 按固定官方文档核对；SQLite 约束按 SQLite 官方语言文档核对。schema、seed 策略和失败变式为原创示例。作者稿未通过正式 R3 或生产数据库验收。
