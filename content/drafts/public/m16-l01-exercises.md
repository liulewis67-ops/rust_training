# M16-L01：HTTP 契约短练习

本练习包配合 `m16-l01-contract` crate。公开 starter 保留了两处待修复契约错误；参考实现与评分规则存放在私有评估区。

## 预测：请求矩阵

给定任务 API：`GET /tasks/{id}`、`HEAD /tasks/{id}`、`POST /tasks`、`DELETE /tasks/{id}`。判断 `GET /absent`、`PUT /tasks/42`、`POST /tasks` 创建成功、字段合法但 title 为空的响应状态与关键 header/body。解释 404、405 与 501 的边界。

提示：先判断 target path 是否存在，再判断 method 是否适用于该资源；405 还需要 `Allow`。

## 修复：POST 创建契约

修复 `create_task`，使有效 title 创建资源时返回 201、`Location: /tasks/43` 和 JSON representation；空白 title 返回 422 且不伪装为 JSON 语法错误。运行 `cargo test` 并检查 `post_returns_created_resource` 与 `empty_title_is_unprocessable`。

提示：保持成功响应与错误响应各自明确；测试对 `Router` 发完整请求。

## 实现：完整 Router 契约测试

扩展 `tests/http_contract.rs`，覆盖 missing path/resource、PUT 对现有路径的 405 + `Allow`、HEAD 无 body、DELETE 的 204 无 body，以及创建后的 representation。对 `Allow` 检查成员，不依赖顺序。

提示：`Router::oneshot` 可在不启动 socket 的情况下验证路由和 handler 组合；不要仅直接调用 handler。
