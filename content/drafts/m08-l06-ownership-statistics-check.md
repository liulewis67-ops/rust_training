# M08-L06：检查——在所有权约束下实现统计

> **综合自测：** 将所有传感器按名称归类、只统计有效读数，并使结果按名字稳定排序；要求保持输入的借用来源。

## 学习目标与先修

完成 M08-L01–L05，能够用 `HashMap`、`Option`、迭代器和借用式 API 实现统计，并解释为什么统计结果的持有期限受输入约束。

## 独立检查说明

按下面给定的类型和函数签名实现 `summarize`，自行编写并运行行为测试。题目中的 `Reading` / `SensorSummary` 由练习者在独立 Cargo 项目内按契约定义，或由未来审核通过的起始包提供；不改变约定接口、不添加第三方依赖。**本站当前没有为本草稿提供在线评分与自动提交。**

## 需求

传感器记录按输入顺序给出。每个不同的 `sensor` 都必须在返回的汇总中有且仅有一行，即使该传感器没有任何可累计读数。

只有 `accepted == true` 且 `value == Some(n)` 的记录参与统计。每条符合条件的记录使 `accepted_count` 加一，并将 `n` 加入 `total`。`Some(0)` 是一个有效读数，计数加一但总和不变；`None` 与 `accepted == false` 都不累计。未接受的记录仍使该传感器出现在结果中。

空切片返回空 Vec。结果按 `sensor` 的 Rust `str` 字典序升序排列。必须保持输入可再次读取；返回的服务名必须从输入借用。题设保证总和能由 `i64` 表示。

## 固定接口

```rust
pub fn summarize<'a>(readings: &[Reading<'a>]) -> Vec<SensorSummary<'a>>
```

使用 `HashMap` 做内部聚合是可行的，但它的遍历顺序不构成输出顺序。你可以把 map 汇总转成 Vec 后显式排序。禁止为了键查找或返回结果而无必要地复制 sensor 字符串。

## 先预测：零值不是缺失值

考虑以下记录：

| sensor | accepted | value | 应否累计 |
| --- | --- | --- | --- |
| alpha | true | Some(0) | 计数 +1，总和 +0 |
| alpha | false | Some(7) | 不累计，但仍是 alpha 的记录 |
| alpha | true | None | 不累计 |
| beta | true | Some(3) | 计数 +1，总和 +3 |

最终结果按 sensor 升序为 alpha（计数 1、总和 0），beta（计数 1、总和 3）。**先写出预期，再实现并运行测试**；不得只按 value 是否为非零判断记录有效性。

## 分阶段验收

1. 建立所有出现过的 sensor 行，即使其累计次数为零。
2. 只有 `accepted && value.is_some()` 才累计，`Some(0)` 计数照样加一。
3. 汇总名称借用自输入，不能为了方便而复制所有传感器名。
4. 用显式排序建立稳定顺序，不依赖 HashMap 内部排列。
5. 针对空输入、同名重复、Unicode、所有读数不合格和合法 0 值写测试。

## 提交时附带说明

1. 哪些读数计入 count 和 total？为什么 `Some(0)` 与 `None` 的处理不同？
2. 汇总里的 sensor 借用了什么？返回 Vec 为什么不能超出名称的生命周期？
3. 哪一步可能分配内存？你的方案是否把每个 sensor 复制成新的 `String`？说明原因。
4. 你如何保证排序契约不依赖 HashMap 的随机种子或遍历顺序？

## 自查清单

- [ ] 每种 sensor 恰有一条输出，包括所有记录都未被接受的 sensor。
- [ ] `Some(0)` 与 `None` 的计数语义不同。
- [ ] 空输入输出空 Vec，输出顺序始终稳定。
- [ ] 在输入可用期间使用借用名称，不复制不必要的字符串。
- [ ] 保留本地测试命令、通过/失败结果与尚未覆盖的输入边界。

## 重置与发布边界

本节仍是预发布草稿，暂不提供在线评分、技能档案或自动重置。若练习者自己建有 Cargo 工作区，保留一份干净起始副本，另外创建修改目录并保存测试结果。未来发布的 ZIP 应单独提供经过核对的清单和哈希，不能把此处的练习说明当作已完成验证的承诺。

## 来源

- [Rust Book：Hash Maps](https://doc.rust-lang.org/book/ch08-03-hash-maps.html)
- [Rust 标准库：Option](https://doc.rust-lang.org/std/option/enum.Option.html)
- [Rust 标准库：sort_by_key](https://doc.rust-lang.org/std/primitive.slice.html#method.sort_by_key)

本节输入、边界用例和验收规程为原创，参考官方文档核对 API 语义。
