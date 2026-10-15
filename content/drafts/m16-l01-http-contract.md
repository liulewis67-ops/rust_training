# M16-L01：HTTP 契约、方法与状态码

## 学完后

- 从资源与操作推导 method、request body、response status、header 和 representation。
- 区分资源不存在的 404、资源存在但 method 不允许的 405，以及服务端不识别/不支持某个 method 的 501。
- 用 Axum `Router` 为 GET/HEAD/POST/DELETE 建立一致契约，并测试非法输入和 Allow。

## 先修

掌握 Rust enum/result、Serde JSON 和 async handler。正式 M16-L01 实施还要求 I09-F02 先通过；本篇只是可独立审阅的作者侧草稿，不会改动 I09 或 M16 的正式状态。

## 先定义资源，再写路由

一个 HTTP contract 要回答：请求目标是什么资源、method 想对它做什么、合法输入长什么样、成功和失败分别返回什么。不要从“handler 能返回什么 tuple”开始随意挑状态码。

| 请求 | 对资源的意图 | 常见成功响应 | 常见失败边界 |
|---|---|---|---|
| `GET /tasks/42` | 读取当前 representation，不修改资源 | `200 OK` + JSON representation | 资源不存在为 `404` |
| `HEAD /tasks/42` | 取得 GET representation 的 metadata，不传 response body | `200 OK` + headers | 路由与 GET 对应；body 必须为空 |
| `POST /tasks` | 在 collection 上创建子资源 | `201 Created` + `Location` 和 representation | 语法正确但领域字段无效可按契约用 `422` |
| `DELETE /tasks/42` | 移除指定资源 | `204 No Content` | 资源不存在仍返回明确 `404` |
| `PUT /tasks/42` | 完整替换一个资源 | 本 API 未开放 | 资源路径存在但 method 不允许为 `405`，并带 `Allow` |

这只是本 lesson 的示例契约；API 可以另有选择，但同一套请求样例、实现与测试必须一致。`201` 表示创建成功，`Location` 指向新资源。`204` 没有 response body；不要同时发送 `204` 和 JSON 内容。

## 404、405 和 501

- `404 Not Found`：目标资源没有当前 representation，或者服务选择不披露其存在。
- `405 Method Not Allowed`：服务器认识 method，但它不能应用于这个 target resource。HTTP 要求 `405` 响应含 `Allow`，列出此资源当前允许的方法。
- `501 Not Implemented`：origin server 没有识别或没有实现请求所用的 method。不要把已识别、但这条资源路由未开放的 `PUT` 一律当 `501`。

在 Axum 中，`Router` path 没匹配时走 router fallback；path 匹配但 `MethodRouter` 没有对应 handler 时，默认给 `405`，并维护 `Allow`。`routing::get` 也会服务 HEAD，请求 response body 会被去除。自定义 method fallback 时，若没有别的 method router 负责生成 Allow header，要自己保持它准确。

## 输入错误也是契约

例子使用 `POST /tasks`。JSON 语法无法解析是请求格式问题；JSON 可解析但 `title` 为空是字段/领域 validation 问题。示例把空标题定义为 `422 Unprocessable Content`，把创建后的资源定义为 `201 Created`。实际 API 应写下具体规则，不要让 extractor 的默认 rejection 偶然成为产品契约。

响应格式与 error code 一样重要：错误状态码可配稳定的错误 representation；不返回 body 的状态应让 client 知道无法读取 JSON。后续 M17 再统一错误类型与 middleware。

## 测试的是完整请求响应

使用 Axum `Router::oneshot` 可以不启动 socket，仍检查 URI、method、headers、status 和 body。测试方法不匹配时要确认实际是 `405` 且 Allow 包含预期 method；缺失路径检查 `404`；HEAD 检查 body 为空；POST 检查 `201`、Location 与 JSON。只调用 handler 单元函数无法验证 route/method 配置。

## 分层提示

1. **资源提示**：这个请求读取现有资源、创建子资源、替换资源还是删除资源？
2. **状态提示**：路径不存在与路径存在但 method 不允许，客户端观察到的状态应该相同吗？
3. **Allow 提示**：收到 `405` 后 client 从哪个 header 了解已开放的方法？
4. **HEAD 提示**：如何让 client 收到与 GET 对应的 header，同时不携带 response body？
5. **validation 提示**：JSON 解码失败与 JSON 合法但字段违反业务规则，是不是同一种错误？
6. **测试提示**：从 `Router` 入口发送 request，哪些 Axum routing 行为是直接调用 handler 看不到的？

## 来源

- [IETF RFC 9110：HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)：method 和 status code 语义、404/405/501 与 405 的 Allow 要求。
- [Axum `routing::get`](https://docs.rs/axum/latest/axum/routing/method_routing/fn.get.html)：GET handler 对 HEAD 的处理。
- [Axum `MethodRouter`](https://docs.rs/axum/latest/axum/routing/method_routing/struct.MethodRouter.html)：方法路由默认 405 与 Allow header。
- [Axum `Router`](https://docs.rs/axum/latest/axum/routing/struct.Router.html)：path fallback 与 method mismatch 的边界。

HTTP 语义来自 RFC，路由行为来自 Axum 官方 API；任务资源与状态表、错误 payload 契约为原创。此草案未经过正式 R3 隔离HTTP/数据库环境和独立学习者验收。
