# M16-L04：IntoResponse 与输入拒绝短练习

## 修复：区分领域错误与解码拒绝

修复 POST handler 的自定义 `ApiError` 映射：JsonRejection 转成 400 + 稳定 `invalid_json`；空白 title 转成 422 + `invalid_title`；有效创建维持 201 + `Location` + representation。

提示：先把 body extractor 错误显式接进 handler，再对解析后的领域类型检查字段。

## 实现：稳定 JSON error response

实现一个 response body struct，并为 error enum 实现 `IntoResponse`。补足 malformed JSON、空 title 和有效创建的完整请求测试。断言 status、machine-readable code、Location 和数据字段，不比对底层 parser 的错误字符串。

提示：每个 enum variant 都应映射到有意的 HTTP 状态和公开错误码。

## 设计评审：review 对外错误消息

评审代码审查意见：“为了方便前端调试，直接将 `JsonRejection::body_text()` 返回给用户；所有错误都用 400”。说明至少两项问题，并提出保留诊断信息、稳定公开 code/status 的替代设计。

提示：区分内部 observability 和兼容性 API contract；领域 validation 不等于语法错误。
