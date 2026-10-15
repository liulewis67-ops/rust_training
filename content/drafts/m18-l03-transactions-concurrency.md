# M18-L03：事务、约束与并发更新

## 学完后

- 用 transaction 把多个相关写操作作为一个提交或回滚单元。
- 将余额非负等不变量同时放入条件更新和数据库约束。
- 用单条条件 `UPDATE` 处理并发扣减，避免读改写丢失更新或透支。

## 先修

完成 M18-L02，掌握参数化查询、`rows_affected` 和 SQLx pool。事务示例只验证 SQLite 本机语义；不同数据库的锁、隔离级别和并发错误策略需要在目标生产引擎单独确认。

## 多步骤业务需要一个事务边界

转账由“扣来源账户”和“增加目标账户”两次更新组成。若第一条语句提交后第二条失败，余额总和会被破坏。使用 SQLx `Transaction` 在同一连接上执行两项变更，全部成功再 commit；预期业务拒绝时显式 rollback 并返回领域结果。若 SQL 执行以 `?` 提前返回，transaction 离开作用域时 SQLx 会启动回滚；需要在业务路径确认回滚结果时，可显式 await `rollback`。数据库故障与可恢复的领域结果要分别表达。

```rust
let mut tx = pool.begin().await?;
let debit = sqlx::query("UPDATE accounts SET balance = balance - ? WHERE id = ? AND balance >= ?")
    .bind(amount).bind(source_id).bind(amount)
    .execute(&mut *tx).await?;
if debit.rows_affected() != 1 {
    tx.rollback().await?;
    return Err(TransferError::InsufficientFunds);
}
// 更新目标账户；目标不存在时也要回滚扣款。
tx.commit().await?;
```

事务并不自动决定业务不变量，也不应跨越网络调用或用户思考时间。尽量缩短事务范围；外部服务调用应留在事务外，并设计重试/幂等策略。

## 约束是所有写路径共享的最后防线

`CHECK (balance >= 0)` 让数据库拒绝任何写入路径产生负数，包含未来新增的 handler、后台任务和 SQL 脚本。应用层可先把“余额不足”作为清晰业务错误返回；数据库约束仍需保留，处理遗漏验证或竞争导致的边界情况。唯一约束、外键和 NOT NULL 也应由 schema 表达。

SQLite 约束失败通常表现为执行错误。发生错误后事务不能假定已提交；明确 rollback 后再读取并确认所有账户保持原状。数据库错误不要映射成“余额不足”一类业务结果，否则会把 schema 损坏或连接故障隐藏起来。

## 原子条件更新防止并发读改写

不安全模式先 `SELECT balance`，在 Rust 判断足够，再用旧数值写回。两个并发请求可能都读到同一余额并都认为成功；后写入覆盖前一次结果，或在无约束时形成负余额。用一个 SQL 语句将条件与变更合并：

```sql
UPDATE accounts
SET balance = balance - ?
WHERE id = ? AND balance >= ?;
```

`rows_affected() == 1` 表示扣款成功；`0` 表示账户不存在或余额不足（若需要区别，可在失败路径再读状态，并接受状态可能继续变化）；SQL error 表示数据库故障。数据库约束与条件更新互补：前者维护全局不变量，后者提供原子业务判断。

## 本机验证边界

契约使用 SQLite pool 并发发起扣款，检查成功次数与剩余余额；事务失败路径先扣款再触发目标缺失，随后验证来源余额已回滚。它不能证明 PostgreSQL 隔离级别、生产锁竞争、死锁重试、分布式事务或容器网络行为。

## 分层提示

1. **原子性提示**：第二步失败时，第一步已经写入的余额要如何恢复？
2. **约束提示**：为什么仅靠 Rust 的 `if balance >= amount` 无法保护所有写入者？
3. **竞争提示**：两个请求都读到 100，再各自扣 80，读改写会发生什么？
4. **条件更新提示**：把余额条件放进同一 `UPDATE` 后，`rows_affected` 的 0 和 1 分别表示什么？
5. **错误提示**：约束错误、余额不足和目标账户不存在应如何区分？
6. **范围提示**：事务持锁期间等待远端 HTTP 响应会带来什么问题？

## 来源

- [SQLx 0.9.0 Transaction](https://docs.rs/sqlx/0.9.0/sqlx/struct.Transaction.html)：transaction commit、rollback 与 drop 语义。
- [SQLx 0.9.0 Executor](https://docs.rs/sqlx/0.9.0/sqlx/trait.Executor.html)：在事务连接上执行查询的接口。
- [SQLite CREATE TABLE](https://www.sqlite.org/lang_createtable.html)：CHECK constraint 的写入约束语义。
- [SQLite Isolation](https://www.sqlite.org/isolation.html)：SQLite 读写事务与并发隔离说明。

事务边界、条件更新和竞态示例为原创设计；API/数据库约束按官方文档核对。作者稿不构成正式 R3 或生产引擎并发验收。
