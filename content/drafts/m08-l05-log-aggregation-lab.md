# M08-L05：实验——日志聚合统计

## 实验目标

实现一个按服务名汇总事件数与字节数的函数，并解释：

- 空输入为什么产生空报告；
- 重复服务名为什么必须累加而不是覆盖；
- 如何借用输入中的 `&str` 键，避免为了聚合而复制服务名；
- 为什么内部使用 `HashMap` 时仍要明确规定输出顺序。

## 输入与输出契约

起始工作区提供 `LogEvent { service: &str, bytes: u64 }` 和待完成的 `aggregate`。假设单个服务的事件数及字节总和均可由目标类型表示。本实验不解析原始日志文本，也不执行文件 I/O。

对输入中的每个不同服务名，结果恰有一行：`event_count` 是其事件个数，`total_bytes` 是这些事件的字节数之和。空输入返回空 `Vec`。服务名区分大小写，Unicode 字符串按原样保留。

输出行按 `service` 的 Rust `str` 字典序升序排列。这个顺序属于实验接口契约；不得依赖 `HashMap` 的遍历顺序，也不得在测试里直接比较无序 map 的遍历结果。

## 工作步骤

1. 先运行公开测试并记录失败测试及实际值。起始错误是重复键调用 `insert` 覆盖旧累计值。
2. 将每个输入事件归并到以借用 `&str` 为键的 map。可以使用 `entry` API；新键初始事件数为 1、字节数为当前事件值，旧键分别递增和累加。
3. 把聚合项转换成 `Vec<ServiceSummary>`，再按服务名排序后返回。
4. 运行格式、编译和公开契约检查。说明 map 键借用自输入，返回结果不能超出相关输入字符串的生命周期。
5. 试一项错误变体：直接收集 `HashMap::into_iter()` 结果，不排序。用乱序输入和有序期望值说明输出契约没有被满足；不要写依赖某次随机排列的测试。

## 参考命令

```text
cargo test --offline
cargo fmt -- --check
cargo check --offline
cargo test --offline
```

第一次测试预期失败；修复后所有公开测试应通过。失败状态必须来自结果断言，而不只是 warning 或编译失败。

## 分层提示

1. **重复键**：`insert` 会怎样处理已经存在的键？比较 `entry(...).and_modify(...).or_insert(...)`。
2. **借用**：map 的键是否必须是 `String`？输入切片和输出汇总分别拥有谁的生命周期？
3. **顺序**：聚合结构负责高效按键更新；哪个结构更适合表达有序报告？
4. **验证**：分别覆盖空输入、同键重复、不同键及 Unicode；比较已排序的期望行。

## 重置

从发布目录中的原始 ZIP 解压到全新目录，核对 `starter-manifest.json` 的文件清单与 SHA-256，再开始一次新尝试。保留原始解压副本作为起始快照；修复和错误变体在另一个副本中进行。课程正式重置需由 R2 项目隔离器与受控评测流程验证，本地解压说明不替代该门槛。

## 来源

- [Rust Book：Storing Keys with Associated Values in Hash Maps](https://doc.rust-lang.org/book/ch08-03-hash-maps.html)
- [标准库：HashMap](https://doc.rust-lang.org/std/collections/struct.HashMap.html)

题面和日志领域数据为原创。官方资料用于核对 map 更新 API 及迭代顺序契约。
