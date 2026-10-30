# M07–M09 进阶实验：真实工程边界与独立验收

此批次不增加课程覆盖率数字，而是提高已经发布的 L05/L06 实验的可检错性。参照工程需通过完整合同测试；starter 仍保留可复现的业务错误，**不得通过删除/弱化公开测试使其变绿**。

## 验收层次

| 层次 | 证明目标 | 真实执行位置 |
| --- | --- | --- |
| M07 trait/dyn | 多种具体 Gate 可以按 `Box<dyn Gate>` 配置顺序执行；第二个拒绝时阻止后续调用并保留第一个错误；空集合无副作用；同一异构对象列表在不同 Build 下重新评估，不能缓存旧错误或执行被短路的副作用 | `content/samples/verified-lesson-drills/tests/graduation_contracts.rs` |
| M08-L05 聚合 | 大小写区分、Unicode 排序、真实指针借用、重复事件累计到 `u64::MAX`、零字节事件仍计数；独立集成测试检查动态 String 借用与大小写区分 | **实际** `m08-starter` 和 `m08-reference` 的公开测试 |
| M08-L06 传感器 | 拒绝记录/缺失值仍留行；有效零计数；`i64::MIN`/ `i64::MAX` 合法抵消；输入借用与确定性排序 | 实际 M08 Cargo 工程 + 独立 L06 集成测试 |
| M09-L05 严格配置 | 重复键的**首次失败优先级**（即使重复字段的新值非法，且后续还有未知字段）、极值/溢出、CRLF、多字节 Unicode 的字符列计数 | 实际 `m09-starter` 和 `m09-reference` 的公开测试 |
| M09-L06 错误传播 | 三类错误固定状态、退出码、重试标志；Unicode/空 `request_id` 精确保留；内部原因保留但 CLI/API 均不能泄漏凭据 | 实际 M09 Cargo 工程 + 独立 L06 集成测试 |
| M06-L06 `Cow` | 已带前缀时返回 Borrowed 且指针偏移正确；未带前缀时返回 Owned；空输入及 Unicode 可处理 | 独立 L06 集成测试，不把空白 `#[test]` 当通过 |

## 可复现命令

在仓库根目录运行，依赖 Rust 1.95.0 / Edition 2024：

```sh
cargo test --offline --manifest-path content/samples/m08-reference/Cargo.toml
cargo test --offline --manifest-path content/samples/m09-reference/Cargo.toml

# 预期保留错误，绝不能把 starter 的非零状态当通过
cargo test --offline --manifest-path content/samples/m08-starter/Cargo.toml
cargo test --offline --manifest-path content/samples/m09-starter/Cargo.toml

# 真正独立于正文空白/TODO 模板的验收源文件
cargo test --offline --manifest-path content/samples/verified-lesson-drills/Cargo.toml --test graduation_contracts

# CI 同时执行新旧全部合同
node scripts/verify-m08-labs.mjs
node scripts/verify-m09-labs.mjs
node scripts/verify-lesson-drills.mjs
```

M08 参考工程现在应通过 10 项公开测试，M09 参考工程通过 11 项。M08 starter 预期 **4 项** 故意失败，M09 starter 预期 **5 项** 故意失败。M09 第五项位于极值综合测试中：重复字段覆盖的坏实现未能先返回 `DuplicateField`。验收脚本必须精确匹配失败测试名称和通过/失败数量，防止将新增故障误当作预设练习。

## 独立交付规则

**学生**应先在干净副本中独立实现固定公共接口，再针对相同输入/预期输出编写并运行自己的测试。仓库中 `graduation_contracts.rs` 是教师端的额外可运行对照，以已验证的样例函数为目标；它不能自动证明学生副本已完成。保留最初失败、修改前后对比、最终断言和一个自拟的反例，说明编译器保证了什么、运行时测试又证实了什么。

短代码围栏、空白的 `#[test]` 和 `todo!()` 本身仍是教学入口，并非完整参考答案。只有真正运行成功且比较了具体业务结果、调用记录或借用来源的独立验收才能作为学习证据。
