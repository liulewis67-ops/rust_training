# M09-L03 练习：库错误和应用错误边界

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
