# M16-L04：IntoResponse 与输入拒绝

## 学完后

- 选择标准 status、tuple response 与自定义 `IntoResponse` 错误类型的适用边界。
- 将 Axum extractor rejection 和领域错误转换为稳定、可公开的 response representation。
- 测试成功、输入拒绝和领域错误的状态码、headers 与 JSON body。

## 先修

完成 M16-L03，理解 Json extractor rejection 在 handler 之前发生。本节处理如何映射这类 rejection，以及 handler 已拿到结构化输入后如何返回领域错误。更广泛的统一 middleware/error envelope 留待 M17；作者稿正式执行仍依赖 I09-F02 和前序验收。

## IntoResponse 是输出边界

Axum handler 可返回任何实现 `IntoResponse` 的值。`StatusCode`、`String`、`Json<T>` 都有常见实现；tuple 可以组合 status、response parts 和 body。类型推导简单时使用 tuple 可读性最好；当多个分支需要长期稳定的 JSON schema 时，显式 response struct 或自定义错误类型更清楚。

```rust
let created = (
    StatusCode::CREATED,
    [(header::LOCATION, "/tasks/43")],
    Json(Task { id: 43, title }),
);
```

不要让两个逻辑上不同的失败碰巧共享 extractor 的默认 response。错误 status、machine-readable code 和 message 是面向 client 的契约；日志中的内部错误信息不应原样泄露进 response。

## 映射两类错误

Json extractor 在语法/反序列化失败、缺少 JSON content type 或 body 读取失败时生成 `JsonRejection`。handler 可接收 `Result<Json<T>, JsonRejection>`，把 rejection 显式转换为应用的 `ApiError`。示例把它映射为 400 和稳定的 `invalid_json` code，不把 axum/hyper 内部细节暴露给 client。

结构成功反序列化后，空白 title 才是领域 validation：示例返回 422 和 `invalid_title`。创建成功则返回 201、Location 和资源 representation。两种失败进入不同控制流和 error code，调用端便能区分“请求无法解码”和“字段违反规则”。

```rust
enum ApiError { InvalidJson, EmptyTitle }

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        // Match the variant to a stable status and JSON error body.
    }
}
```

`IntoResponse` 实现必须穷尽每个错误变体，并让 status 与 representation 一致。若 error type 包含底层 `JsonRejection`，可以记录它供内部诊断，但公开 body 应只含已承诺的 fields。非穷尽的外部枚举要用 wildcard/适配边界处理未来新增 variant。

## 测试响应，而不测偶然文本

通过完整 Router 发请求，分别断言 response status、`Location`、可解析 JSON 和稳定 `code`。对 400/422 关注 schema 与 code，而不是依赖底层 rejection 的调试字符串；这样 Axum 升级时不会把内部 wording 变化变成 API 破坏。

## 分层提示

1. **返回类型提示**：返回 `Json<T>` 与返回 `(StatusCode, Json<T>)` 有什么区别？
2. **错误边界提示**：Json 反序列化失败时 handler 会不会得到 `NewTask`？
3. **映射提示**：如何把 `JsonRejection` 转成 API 自己承诺的 `invalid_json`？
4. **领域提示**：字段结构可解码但 title 空白，为什么不是同一个 extractor rejection？
5. **泄漏提示**：把 rejection 原始 `body_text()` 直接返回 client 有什么兼容/信息风险？
6. **验证提示**：测试应观察 status/code/schema 还是依赖整段动态错误文本？

## 来源

- [Axum `IntoResponse`](https://docs.rs/axum/0.8.9/axum/response/trait.IntoResponse.html)：标准 response 实现、tuple 组合及自定义错误。
- [Axum response module](https://docs.rs/axum/0.8.9/axum/response/index.html)：常用 body/status response 形式。
- [Axum `JsonRejection`](https://docs.rs/axum/0.8.9/axum/extract/rejection/enum.JsonRejection.html)：JSON rejection 变体与错误信息入口。
- [Axum `Json`](https://docs.rs/axum/0.8.9/axum/struct.Json.html)：JSON extractor rejection 条件。

response trait 与 rejection 来自 Axum 0.8.9 官方 API；`invalid_json`、`invalid_title` 的应用合同和量规为原创。作者稿尚未通过 R3、独立学习者或正式门槛验收。
