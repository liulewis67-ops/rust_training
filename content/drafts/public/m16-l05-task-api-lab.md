# M16-L05 实验：内存任务 API

## 目标

在不连接数据库的前提下，从 Axum starter 实现 CRUD task API。通过 Router request panel（本地实验阶段可用公开集成测试）验证路径、方法、状态码和 JSON representation；一个 ID 分配缺陷故意留在 starter 中。

## API contract

| Method / path | 结果 |
|---|---|
| `GET /tasks` | `200` + 按 id 排序的 JSON 数组 |
| `POST /tasks` | 有效 title：`201` + 唯一递增 id 与资源 body；空 title：`422` |
| `GET /tasks/{id}` | 命中 `200` + task；缺失为 `404` |
| `PUT /tasks/{id}` | 替换已有表示并返回 `200`；缺失为 `404`；无效 title 为 `422` |
| `DELETE /tasks/{id}` | 删除成功为无 body `204`；缺失为 `404` |
| 已知 path 上未开放的方法 | `405`，保留 Axum `Allow` |

## 工作流程与重置

1. 解压 `m16-l05-task-api-starter.zip` 到全新工作目录，不要在已有目录叠加旧文件。
2. 运行 `cargo test` 观察公开基线。先定位多次 POST 覆盖同一 ID 的根因，再修复并重新运行。
3. 从全新 ZIP 再启动一次，确认 starter 可以重现同一失败；不要把第一次修复后的工作区当作 reset。
4. 用 `starter-manifest.json` 核对每个公开源文件 SHA-256。提交前保留 manifest、Cargo.lock 与实验实现快照，记录样例版本和结果。

## 常见错误

- 每个 POST 固定返回同一个 ID，导致第二条资源覆盖第一条。
- PUT 不检查资源是否已存在，悄悄把 missing item 当作创建。
- DELETE 返回带 JSON body 的 `204`，或删除不存在资源时仍假报成功。
- 空白 title 被储存，或 JSON rejection 未明确处理。
- 用 `unwrap` 将无效请求变成 panic；所有坏请求都应是可预测 response。

本实验是纯内存 API authoring sample；完成本机练习不代表平台 R3 受控工作区、快照服务或正式 P3 技能验收。
