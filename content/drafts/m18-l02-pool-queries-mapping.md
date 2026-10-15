# M18-L02：连接池、参数化查询与结果映射

## 学完后

- 将可 clone 的 SQLx pool 句柄放在应用共享状态中，并限制连接数与生命周期。
- 使用绑定参数传递用户输入，不把数据拼接进 SQL 语句。
- 将查询结果映射为应用拥有的类型，并正确处理 0、1 和多行结果。

## 先修

完成 M18-L01，能够建立 schema、运行 migration 并为测试隔离 SQLite 数据库。本节以 SQLite 内存 pool 本机验证行为；真实 R3 连接网络和生产数据库配置仍需正式环境验收。

## Pool 是共享句柄，不是单条连接

SQLx `Pool<DB>` 可 clone，clone 共享底层连接池。应用启动时建立 pool，将句柄放入 AppState，由 handler/service 共享。池大小应结合数据库连接预算、请求并发、超时和部署副本数设置；无限扩大 pool 会把本地排队转变成数据库过载。

```rust
let pool = SqlitePoolOptions::new()
    .max_connections(5)
    .connect("sqlite::memory:")
    .await?;
```

该连接串仅适用于本机内存练习。真实部署应通过受保护的配置提供连接参数，避免把凭据写入源码、日志或错误响应。pool handle 的 clone 不等于每次请求新建一组物理连接。

## 把用户值绑定为 SQL 参数

查询结构与查询数据是两个不同输入。SQLx `query_as` 中使用 `?` 占位符（SQLite），再用 `.bind(value)` 传入值；数据库 driver 会把用户数据作为参数处理，而不会重新解析成 SQL 语法。

```rust
let label = sqlx::query_as::<_, Label>(
    "SELECT id, name, created_at FROM labels WHERE id = ?",
)
.bind(id)
.fetch_optional(pool)
.await?;
```

不要用 `format!`、`push_str` 或插值把用户输入拼成 SQL。动态表名、列名或排序方向通常不能作为普通绑定值；这类结构选择要由程序内有限白名单映射到固定 SQL 片段，而查询值仍绑定传入。

## 结果映射表达零行与多行

单行查询依需求选择 `fetch_optional`（0 或 1 行）或 `fetch_one`（必须有 1 行，否则返回 `RowNotFound`）。可能多行的列表查询用 `fetch_all`；若只需一个汇总值则使用 scalar 查询。明确结果类型能使缺失资源成为 `None`，而数据库故障继续以 `Err` 表达。

用 `#[derive(sqlx::FromRow)]` 映射 `Label` 时，SQL 列名、类型和 NULL 可能性要与 Rust 字段相符；`Option<T>` 应与数据库允许为空的字段一致。查询测试应分别覆盖缺失 ID、单个已知 ID 和多个 prefix 匹配结果，不能把 `fetch_one` 的“必须存在”误当“最多一个”。

## 本机验证边界

公开 starter 使用字符串拼接并以 `AssertSqlSafe` 显式绕过 SQLx 对动态语句的编译期审查，注入样例会改变查询条件并返回不应匹配的行。这个 wrapper 是给经过人工审核的动态语句的责任声明，不会清理用户输入；不能把它用来压掉审查错误。私有参考实现通过 `.bind` 参数化，并测试 0/1/多行行为。以上 SQLite 内存测试不验证 R3 网络路径、TLS、连接池部署预算或其他 SQL 方言。

## 分层提示

1. **生命周期提示**：pool 在每个 request 建立还是在 app startup 建立？clone 句柄会复制底层连接吗？
2. **绑定提示**：哪部分是 SQL 语法，哪部分是用户数据？为什么 bind 不会把引号内容解释成 WHERE 子句？
3. **结果提示**：资源可能不存在时，`fetch_optional` 和 `fetch_one` 分别如何表达？
4. **映射提示**：数据库 NULL、列名和 Rust 类型不一致时，错误在哪一层出现？
5. **注入提示**：如何构造一个含 SQL 控制字符的合法输入，证明它只作为值参与匹配？
6. **容量提示**：服务副本数、每实例 pool 上限与数据库连接预算之间是什么关系？

## 来源

- [SQLx 0.9.0 Pool](https://docs.rs/sqlx/0.9.0/sqlx/struct.Pool.html)：连接池句柄、clone 与连接管理 API。
- [SQLx 0.9.0 query_as](https://docs.rs/sqlx/0.9.0/sqlx/fn.query_as.html)：FromRow 结果映射及参数绑定查询。
- [SQLx 0.9.0 QueryAs](https://docs.rs/sqlx/0.9.0/sqlx/query/struct.QueryAs.html)：bind、fetch_optional、fetch_one 与 fetch_all 语义。
- [SQLx 0.9.0 AssertSqlSafe](https://docs.rs/sqlx/0.9.0/sqlx/struct.AssertSqlSafe.html)：动态 SQL 的显式安全断言边界；它不会对用户值做参数化或转义。

API 说明依 SQLx 0.9.0 官方文档核对；Label 查询和注入哨兵为原创示例。作者稿不构成正式 R3 或生产数据库验收。
