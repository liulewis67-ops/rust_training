# M18-L05 实验：P3 持久化任务 API

## 目标

从 Axum starter 完成 SQLx/SQLite 持久化任务 API。练习迁移、连接池、参数化 CRUD 与数据库重启后的持久化。公开 starter 故意忽略调用方给出的文件数据库 URL；普通 CRUD 可通过，但进程/连接池重启检查会检出数据丢失。

## API 契约

| Method / path | 结果 |
|---|---|
| `GET /tasks` | `200` + 按 id 升序排列的 JSON 数组 |
| `POST /tasks` | 非空 title：`201` + 数据库分配的 id；空白 title：`422` |
| `GET /tasks/{id}` | 命中 `200`，缺失 `404` |
| `PUT /tasks/{id}` | 替换 title/completed 并返回 `200`；缺失 `404`；空 title `422` |
| `DELETE /tasks/{id}` | 成功 `204` 无响应体；缺失 `404` |
| 已知 path 上未开放的方法 | `405` 且保留 `Allow` |

数据库是实验应用自己的 SQLite 文件。不要将连接 URL、表或迁移指向平台技能/提交数据库；不要把用户 id 或提交状态写入任务表。API handler 只访问传入的应用 `SqlitePool`。

## 工作与重置流程

1. 解压 `m18-l05-persistent-task-api-starter.zip` 到一个全新目录。不要把旧工作区覆盖叠加。
2. 运行 `cargo test`：CRUD 应通过，`file_backed_data_survives_pool_restart` 应失败。沿着 `open_pool` 检查为何文件 URL 没有生效。
3. 从头修正连接选项，使迁移在提供的文件 URL 上运行；通过全部公开检查。保留参数绑定、错误状态和迁移约束。
4. 用 ZIP 再解压到另一个全新目录，确认基线故障再次出现；将 `starter-manifest.json` 中路径与 SHA-256 对上。重置以干净解压为准。
5. 将 ZIP、manifest、锁文件、实现快照和本机验证结果关联到同一实验版本。平台快照/提交 ID 由受控工作区生成，本地作者包不伪造该证据。

## 边界与常见错误

- 文件数据库需在关闭首个 pool 后重新打开同一个 URL；两个 `sqlite::memory:` pool 不是同一个持久化数据库。
- 迁移只能建立实验应用的 `tasks` schema，不要使用平台库。
- 标题验证在应用层提供友好 `422`，数据库 `CHECK` 是额外的不变量防线。
- 查询值必须绑定，不拼接 SQL；排序列表要显式使用稳定的 `id`。
- 数据库故障不是 `404`；错误处理不可把连接故障伪装成“资源不存在”。
- 本机 SQLite 检查不证明 R3 镜像、平台数据库隔离、受控提交快照或 PostgreSQL 行为。

## 分层提示

1. `open_pool` 的参数在哪里进入 `SqliteConnectOptions`？
2. 关闭第一连接池再创建第二个连接池，为什么是持久化检查而不是同一 pool 内读取？
3. 插入后从数据库回读可如何把生成 ID 的行为放在数据库语义内？
4. 更新 0 行和 SQL 执行失败分别表示什么？
5. SQLite 约束、应用输入验证与平台提交数据分别属于哪一层？

## 验收边界

作者侧可验证 API 合同、错误 starter 被拒绝、干净 ZIP 重置和本机文件数据库重启。正式 P3 验收仍需 R3 隔离 HTTP/数据库环境、受控快照和平台版本追溯；这些作者侧结果不替代正式验收。
