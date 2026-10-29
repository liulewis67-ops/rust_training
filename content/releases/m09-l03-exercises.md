# M09-L03 练习：库错误和应用错误边界

> **练习路线：** 用同一组领域错误分别验证 CLI 和 HTTP 适配器，防止传输协议渗入业务库。

## 学习目标与顺序

按“预测 → 修复 → 实现”完成三项练习。先记录预期的编译结果、返回值或错误来源，再运行本地 Rust 1.95.0 / Edition 2024 检查；本节已正式发布。

## 1. 预测：一个 CoreError，两个应用结果

使用正文中的 CoreError、map_cli 和 map_api，预测 InvalidPort、ProfileNotFound 与 Storage 三种错误分别得到的 CLI 退出码和 API 状态码。Storage 包含一条模拟的 PermissionDenied 底层原因；说明它在库层是否仍可通过 source() 访问、API 会不会回传这段内部信息。

**提示**：先匹配 CoreError 的业务变体，再分别沿 CLI/API 的映射函数追踪。

**验证契约**：InvalidPort 得到 CLI 2/API 400；ProfileNotFound 得到 CLI 3/API 404；Storage 得到 CLI 1/API 500。Storage 的 source 仍是 io::Error；本例 CLI stderr 可包含本机诊断细节，API 仅返回 internal_error 与通用消息。

## 2. 修复：把所有错误都当成服务器故障

下面的映射把输入错误和缺失资源也一律转成 HTTP 500。修复 match，使 InvalidPort 返回 400/invalid_port，ProfileNotFound 返回 404/profile_not_found，只有 Storage 返回 500/internal_error。每个分支的公开 message 应保持稳定且不包含 source 文本。

~~~rust
/// Maps every library error to one generic API failure.
fn map_api(error: &CoreError) -> ApiFailure {
    let _ = error;
    ApiFailure {
        status: 500,
        code: "internal_error",
        message: "internal server error",
    }
}

/// Checks business errors remain distinct from internal failures.
fn main() {
    let invalid = CoreError::InvalidPort { line: 3 };
    let missing = CoreError::ProfileNotFound {
        name: String::from("daily"),
    };
    assert_eq!(map_api(&invalid).status, 400);
    assert_eq!(map_api(&missing).status, 404);
}
~~~

**提示**：按 CoreError 变体匹配，不要根据 Display 字符串猜类别。对内部 Storage 错误不要把 source 拼入 API message。

**验证契约**：起始代码可编译但两项断言失败；修复后无效输入与缺失资源各自映射到对应 4xx，Storage 的 5xx 映射仍然存在且信息经过净化。

## 3. 补全测试：分别锁定 CLI 与 API 契约

补全下面的测试，至少核对三种 CoreError 的 CLI 退出码和 API 状态/错误码；另外验证 Storage 的原始 source 保留在库错误里，但 API message 不泄露模拟的内部路径。不要只测 CLI 或只测 API。

~~~rust
/// Completes assertions for three error categories at both application edges.
#[test]
fn library_errors_map_to_cli_and_api_contracts() {
    let invalid = CoreError::InvalidPort { line: 6 };
    let missing = CoreError::ProfileNotFound {
        name: String::from("daily"),
    };
    let storage = CoreError::from(std::io::Error::new(
        std::io::ErrorKind::PermissionDenied,
        "private path",
    ));

    // TODO: Assert invalid input, missing resource, and internal failure mappings.
    // TODO: Assert the library source is retained and private path is not in API output.
}
~~~

**提示**：分别验证 API 的 status 与 code。不要强行要求 CLI 和 API 使用同一种表示；两个边界的契约不同。

**验证契约**：invalid port → CLI 2/API 400 invalid_port；missing profile → CLI 3/API 404 profile_not_found；storage → CLI 1/API 500 internal_error。source() 可下转型为 io::Error；API 响应不包含 private path。

## 自查清单

- [ ] 业务错误、缺失资源和内部错误被映射成不同的外部类别。
- [ ] 内部 SQL/地址/凭据不出现在公开响应。
- [ ] CLI 与 API 各有独立契约断言，不互相复用状态码。

以上检查请以实际代码和行为断言为准，而不是仅凭工具链返回退出码为 0。

## 4. 进阶实证：相同 CoreError 的 CLI/API 边界契约与泄漏风险

预测 InvalidPort、ProfileNotFound 和 Storage 的 CLI/API 映射，运行两项测试。把 `map_api` 暂时改为对所有错误返回 500，观察哪项断言失败；再改为在公开信息中拼接底层 `source`，验证泄漏断言为什么必要，最后恢复严格边界。

**验收：** 提供 `cargo +1.95.0 test --offline --manifest-path content/samples/verified-lesson-drills/Cargo.toml m09_boundaries::` 的通过结果、错误示例或行为回归的证据，并解释为什么最小修复不改变原有接口契约。

## 参考答案

1. 对于正文中的 `CoreError`：`InvalidPort` → CLI 2 / API 400，`ProfileNotFound` → CLI 3 / API 404，`Storage` → CLI 1 / API 500。仅在应用边界决定这些表示。
2. `map_api` 应逐变体返回稳定的 `status`、`code` 和 `message`，例如输入错误用 `400 / invalid_port`，资源缺失用 `404 / profile_not_found`，内部故障用 `500 / internal_error`；不要由 `Display` 字符串猜分类。
3. 对每一种错误分别断言 CLI 退出码、API 状态与错误码。存储失败的 `source()` 应仍是 `io::Error`，但面向 API 的公开消息不能包含模拟的内部路径。

**边界说明：** 本节的 CLI 与 API 示例故意使用不同的日志/消息暴露策略；真实生产环境应对终端和远程调用方都评估权限与泄漏风险，不能直接复用内部错误原文。

## 来源

- [The Rust Programming Language：Error Handling](https://doc.rust-lang.org/book/ch09-00-error-handling.html)
