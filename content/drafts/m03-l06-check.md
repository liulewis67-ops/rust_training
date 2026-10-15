# M03-L06：独立检查——提醒状态与缺失查询

本检查确认你能把 `Option` 查询结果与陌生枚举状态组合起来，并让公开函数文档与实际行为一致。请先提交自己的实现和说明；只有首次独立提交可作为未看答案的技能证据。不要先打开教师侧评分参考。

## 任务

实现 `next_action`，根据可选的提醒状态返回动作标签：

```rust
/// Returns the documented next action for an optional alert status.
///
/// A missing status returns `"not found"`. Queued alerts are claimed;
/// claimed alerts are delivered. A delivered alert is retried while attempts
/// are below two, then archived. User-cancelled alerts are closed; other
/// cancellations are reviewed.
pub fn next_action(status: Option<AlertStatus>) -> &'static str {
    // TODO: Match None, Some, and every AlertStatus variant explicitly.
    todo!()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AlertStatus {
    Queued,
    Claimed,
    Delivered { attempts: u8 },
    Cancelled { by_user: bool },
}
```

## 契约

- `None` 返回 `"not found"`。
- `Queued` 返回 `"claim"`；`Claimed` 返回 `"deliver"`。
- `Delivered { attempts }` 在 `attempts < 2` 时返回 `"retry"`，否则返回 `"archive"`。
- `Cancelled { by_user: true }` 返回 `"close"`；`Cancelled { by_user: false }` 返回 `"review"`。
- 处理 `Option` 的 `None` 和 `Some`，并显式匹配每个枚举形态；不要用 `_` 代替状态分支。未来新增一个枚举变体时，匹配应由编译器要求重新审视。
- 公共函数的文档与每条可达路径一致。不能 panic、硬编码只覆盖公开示例，也不能将缺失状态映射为其他成功动作。

公开检查点：`None` 返回 `not found`；`Some(Queued)` 返回 `claim`；`Some(Delivered { attempts: 1 })` 返回 `retry`；`Some(Delivered { attempts: 2 })` 返回 `archive`；两种 `Cancelled` 分别返回 `close` 和 `review`。这些例子不是完整测试集。

## 提交

提交函数实现和一段简短说明，逐项解释 `None`、四种枚举变体及 `Delivered` 的边界，并指出若新增状态会如何触发穷尽性检查。首次提交前不要查看参考答案或教师评分文件。

## 失败反馈与继续训练

平台失败反馈应区分：编译/穷尽匹配、缺失状态、状态映射、携带数据的边界条件、文档与实际行为不一致。首次提交记录完成后，可以按层查看提示并重试；查看参考解后的学习提交不能覆盖首次独立证据。运行器或快照故障标记为待复核，不据此降低技能等级。

## 来源

- [The Rust Programming Language：Defining an Enum](https://doc.rust-lang.org/book/ch06-01-defining-an-enum.html)
- [The Rust Programming Language：The `match` Control Flow Construct](https://doc.rust-lang.org/book/ch06-02-match.html)

题面、状态模型、边界点和反馈分类均为原创设计。
