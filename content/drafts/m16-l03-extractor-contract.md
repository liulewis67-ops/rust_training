# M16-L03：Path/Query/Json 与提取顺序

## 学完后

- 组合 `Path`、`Query`、`State` 与 `Json`，让 request shape 清楚地映射到类型。
- 判断 extractor rejection 与领域 validation 的边界，并为合法/非法输入写测试。
- 解释为什么 body-consuming extractor 只能出现一次且必须放在 handler 参数末尾。

## 先修

完成 M16-L02，掌握 Axum Router、handler 和完整请求测试。本节只讨论参数提取及 request body 所有权；统一错误响应与 rejection 映射在 M16-L04 处理。正式课仍依赖 I09-F02 和 M16-L02 验收。

## 从 URL 提取资源定位与筛选

`Path<T>` 负责从 route captures 反序列化资源定位参数，例如 `/tasks/{id}` 的 `u64` id。`Query<T>` 把 query string 反序列化为筛选/分页结构。handler 参数类型就是 endpoint 的输入 contract；类型不匹配会在 handler 执行前产生 Axum rejection。

```rust
#[derive(Deserialize)]
struct PageQuery { page: Option<u32> }

async fn show_task(
    Path(id): Path<u64>,
    Query(query): Query<PageQuery>,
) -> impl IntoResponse {
    let page = query.page.unwrap_or(1);
    // use id and page to build the representation
}
```

在固定 Axum 0.8.9 默认 rejection contract 下，Path 解析失败、Query 缺少/无法解析字段、JSON 语法或反序列化失败都会拒绝请求，不进入 handler；题包会实际检查这些 response。应用若需要不同状态或稳定错误 payload，应在抽取失败边界显式映射，不应误称 handler 已拿到非法的 `u64` 或结构体。

## body 只能由一个 extractor 消费

Axum 按函数参数从左到右执行 extractor。`Path`、`Query`、`State` 和 headers 从 request parts 读取；`Json<T>` 需要读取异步 body stream，因此实现 `FromRequest` 的 body extractor 必须是最后一个参数。body 只能消费一次：两个 Json extractor，或 Json 后还有 parts extractor，handler 都不能成为有效的 Axum handler。

```rust
async fn add_label(
    Path(task_id): Path<u64>,
    Query(options): Query<LabelOptions>,
    Json(input): Json<NewLabel>, // consuming body 的 extractor 放最后
) { /* ... */ }
```

先从 Path/Query/State 建立 parts 输入，再把唯一 body decoder 放在末尾。不要为了“先 parse JSON”而把 `Json` 移到 `Path` 前面；用编译失败样例呈现顺序约束，也用完整 Router 请求检查实际 rejection。

## 三层输入边界

1. **传输/提取失败**：body 不符合 JSON 语法、path id 不是数字、query page 无法解成整数，handler 不会执行。
2. **结构有效性**：JSON 可以解码但字段缺少或类型不符，仍是 extractor 的反序列化拒绝。
3. **领域规则**：类型齐全、结构可解码，但业务值不合格；此时 handler 才能运行领域 validation 并返回 API 约定的结果。

这些错误可以使用不同 response contract。此节以 Axum 默认 rejection 作基线，不在练习里承诺默认错误体是稳定 API；M16-L04 会把 rejection 包成应用拥有的 response。

## 测试完整提取过程

从 `Router::oneshot` 发有 Path、有 Query 和 JSON body 的请求，检查 handler 收到的字段；再分别发无法 parse 的 path、query 和 JSON。不能只单元测试领域函数，因为 extractor rejection 会先于 handler 执行。body 顺序则是类型/编译门槛，写一个 `compile_fail` 反例，确认错误真正来自不合法的 handler 形状。

## 分层提示

1. **URL 提示**：`/tasks/42?page=3` 的 `42` 与 `page=3` 分别从何处提取？
2. **类型提示**：path id 写成 `u64`，收到非数字时 handler 会看到 `Err` 还是根本不会运行？
3. **body 提示**：哪些 extractor 消费 body？body 还可被第二次读取吗？
4. **顺序提示**：`Json<T>` 后还能列 `State<T>` 或 `Path<T>` 吗？为什么？
5. **错误提示**：JSON 解码成功后 title 空白与 JSON 根本解不出来，是同一处理阶段吗？
6. **测试提示**：如何证明不合法的 query 在 handler 执行前就被拒绝？

## 来源

- [Axum 0.8.9 Extractors 文档](https://docs.rs/crate/axum/0.8.9/source/src/docs/extract.md)：参数从左到右提取、body 只可消费一次，body extractor 要位于末尾。
- [Axum `Path`](https://docs.rs/axum/0.8.9/axum/extract/struct.Path.html)：path capture 的反序列化和 rejection。
- [Axum `Query`](https://docs.rs/axum/0.8.9/axum/extract/struct.Query.html)：query string 提取与 rejection。
- [Axum `Json`](https://docs.rs/axum/0.8.9/axum/struct.Json.html)：JSON body 解码和默认 rejection 条件。

提取顺序和 Axum 默认拒绝行为来自 0.8.9 官方文档；任务筛选输入、编译失败样例和测试矩阵为原创。此草案未通过 R3 或独立学习者验收。
