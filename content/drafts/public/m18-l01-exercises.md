# M18-L01：schema 与 migration 短练习

## 预测：迁移与种子执行次数

说明空数据库首次运行 migration、再次运行 migration、再重复 seed 的行为；指出 migration ledger 与 seed 冲突策略分别负责什么。

提示：Runner 跳过已登记版本，不会自动重放任意业务 seed 函数。

## 修复：补全 label 数据库约束与安全 seed

修复迁移缺失的 name 不可空白约束和 seed 重复执行错误；保留主键、稳定 ID 和字段类型。

提示：在数据库写入边界拒绝空白值，固定 seed ID 的冲突策略要显式。

## 实现：空库、重复运行与坏 schema 验证

使用隔离 SQLite 内存库运行迁移；验证 seed 可重复应用、空白名称被数据库拒绝，并在迁移前创建不兼容 schema 确认失败有错误返回。

提示：每个场景用新连接池，坏 schema 测试要在 migration ledger 被建立前准备冲突表。
