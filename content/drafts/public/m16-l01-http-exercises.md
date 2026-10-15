# M16-L01 短练习：HTTP 契约、方法与状态码

## 1. 预测：一组请求的资源语义

针对 `/tasks/42` 有 GET、HEAD、DELETE；`/tasks` 只接受 POST。预测 `GET /absent`、`PUT /tasks/42`、`HEAD /tasks/42`、有效 `POST /tasks` 和空标题 POST 的状态码/body/关键 header。

**契约**：区分资源未命中与 method 不允许；创建包含 Location；HEAD 不包含 response body；字段 validation 按题面给出 422。

**提示**：先确定 path 是否匹配，再判断此资源 router 是否安装该 method。

**验证**：用题面矩阵逐行标出 status、Allow/Location 与 body 规则。

## 2. 修复：创建响应不符合契约

修复 starter 的 POST handler：创建成功需返回 201、`Location: /tasks/43` 与创建资源 JSON；空白 title 必须返回 422，不创建资源。

**契约**：请求路由不变；不得对所有 POST 都返回同一个 status，也不能把合法 JSON 的领域 validation 错误伪装为语法错误。

**提示**：分别看新资源已经创建和输入没有通过 title 规则的分支。

**验证**：`post_returns_created_resource` 与 `empty_title_is_unprocessable` 检查 status、headers 和 body。

## 3. 实现：通过 Router 验证 method 与 path

补全 `Router::oneshot` 请求测试，覆盖 GET/HEAD/DELETE、对已有资源发 PUT，以及缺失资源/路径的 GET。

**契约**：存在但未开放的 method 是 405 并带正确 Allow；缺失 target 是 404；HEAD body 为空；DELETE 成功为 204 且无 body。

**提示**：用实际 `Method` 与 URI 构造 request，观察完整 response，避免只单测 handler。

**验证**：`method_path_and_head_contracts` 检查 route 状态及 body/Allow。不要断言 HTTP 不保证的 header 顺序。

## 答案与尝试

独立提交前不要读取 M16 私有评分与参考实现。查看提示仍可继续学习，但不能将此次记录为未看答案的独立能力证据。

## 先修

I09-F02 正式前置与 Rust async/Serde 基础。本地样例无需服务或数据库；正式课程仍需 R3 隔离环境和独立学习者验收。
