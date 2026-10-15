# M18-L04：分页与索引短练习

## 修复：分页遇到并发插入

将按 offset 的分页改为使用 `(name, id)` 复合 cursor 的 keyset 查询；绑定 cursor 和 page size，并保留稳定排序。

提示：查询上一页最后一条记录，再继续读取排序键严格大于它的记录。

## 实现：分页契约与查询计划

实现连续两页查询，页间在 cursor 前插入一条记录；证明后续页无重复，并用 EXPLAIN QUERY PLAN 验证复合索引。

提示：插入键必须小于上页末尾；计划要包含预期索引名。

## 设计评审：离线 query metadata

评审 SQLx 静态查询 metadata 的生成、更新和 CI 离线检查方案；列出 SQL/schema 改动后必须做的步骤。

提示：runtime query_as 与 compile-time query! 的验证边界不同；metadata 必须与实际 migration/schema 同源。
