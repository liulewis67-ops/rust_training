# M21-L01：三道短练习

## 1. 预测：字段还是拼好的 message？

给定请求 `GET /users/missing`、有效 `X-Request-ID: req-a9`，预期 handler 返回 404。预测哪些是低敏感、低基数的独立 event fields；指出下列候选里哪些不能记录：

```text
request_id, http.request.method, http.route, status, duration_ms,
authorization, cookie, body, raw_path, error_chain
```

**契约**：handler event 与最终 response event 使用 `req-a9`；状态记录 404；route 是 `/users/{id}`；secret sentinel 不出现在任何字段。把所有值塞进一个 `message` 字符串不满足 queryability。

**提示**：字段让采集器按 key/type 过滤；message 用短句解释人类可读语义。metric labels 不承载 request id 或用户/任务 ID。

## 2. 修复：凭据泄漏且字段不可查询

公开 handler 将 Authorization 与 body 拼到单个 `message`，并且只在成功路径记录 status。修复为 span/event 结构化字段：移除 token/body，保留已验证 request-id、HTTP method、route template、最终 status、duration 和安全 outcome；404/503 仍需关联。

**提示**：用 `CaptureSubscriber` 收集真正的 tracing event fields；响应状态测试和日志脱敏测试是不同的观测面。

## 3. 实现：上下文贯通

为 Axum API 实现统一 request context：验证或生成 request ID，在 handler 通过 extension 读取并用于 span，给成功和失败 response 设置相同 header；在结束 event 中记录可查询且不含输入值的字段。为一个 endpoint 增加非敏感 route-template 字段和有界 `outcome` enum。

**提示**：不要跨 `.await` 保持 `span.enter()`；将 future `.instrument(span)`。不可信 URI 的具体 path/query 不应直接作为 route 字段。
