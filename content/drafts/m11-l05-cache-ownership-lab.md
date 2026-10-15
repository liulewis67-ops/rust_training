# M11-L05 实验：修复缓存持有关系

## 情境

一个单线程缓存拥有缓存条目；条目为了回查缓存键而保存了缓存 owner。当前实现两端都使用 `Rc`，让本来只是反向查询的关系也参与拥有。程序退出局部作用域后，条目 Drop 计数仍为零。

本实验从 `m11-l05-cache-ownership-starter.zip` 的新副本开始。你将先运行基线并记录两个失败契约，然后把条目到缓存的边改成非拥有的弱引用，解释缓存已经释放时的回查行为，并再次从干净副本验证完整修复。

## 目标

- 用拥有图说明缓存强拥有条目、条目回查缓存的关系。
- 用 Drop 计数观察强引用环阻止条目清理。
- 用 `Weak::upgrade` 安全处理缓存被释放的情况。
- 保持缓存存活期间的查找行为与条目 key 稳定。

## 实验任务

1. 解压公开起始包到全新目录，核对 README 中的归档文件清单和 SHA-256。
2. 运行 `cargo test --offline`，记录哪些基线行为断言失败以及失败原因。
3. 阅读类型定义，画出 Cache、entries map、Entry 的强/弱拥有图；解释局部变量 drop 后为什么 Entry 未清理。
4. 修复 Entry 回指，不让它强拥有缓存；缓存仍必须强拥有其条目。
5. 缓存有效时，条目通过回指仍可确认 key 存在。缓存释放后，即使调用方还有一个 Entry handle，回指也应返回 false，不能 panic。
6. 验证最后一个 Entry 强 owner 释放后 Drop 计数增加一次。禁止通过 `mem::forget`、手动改计数或跳过断言让测试变绿。
7. 完整运行格式、检查、测试、严格 Clippy 与文档命令，并保留终端结果。

## 通过标准

- 基线两项关键测试均失败：缓存先 drop 后 Entry 回指仍报告缓存存在；所有外部 handle drop 后 Drop 次数仍为 0。
- 修复后所有公开行为测试通过，Entry 可在缓存释放后暂时由外部 handle 存活，但弱回指正确返回 false。
- 缓存释放且 Entry 最后 owner 释放后，Drop 恰好运行一次；没有剩余强引用环。
- ZIP 解压副本从零开始可重现上述红/绿验证，不依赖 workspace 外的生成文件。

## 命令

在 crate 根目录运行：

```text
cargo test --offline
cargo fmt -- --check
cargo check --offline
cargo clippy --all-targets --offline -- -D warnings
cargo doc --no-deps --offline
```

## 重置

不要在已修复目录上再次记录基线。重新从公开 ZIP 解压到一个新的空目录即可恢复原始起始状态。保留失败基线的文本日志，再在副本中完成修复。参考实现不放在公开起始 ZIP 中。

## 参考答案方向

条目对缓存使用 `Weak<RefCell<HashMap<...>>>`。缓存仍用强 Rc 持有 map，map 强拥有 Entry。查询时尝试 upgrade，若缓存已被释放则安全返回 false。Drop 计数器继续由 Cache 和 Entry 共享，不能改成另一个单独延长 Entry 生命周期的强关系。
