# M03-L02 三道短练习草案

状态：课前草稿；依赖 M03-L01，尚未接入课程目录或 R1。

## 1. 预测：按变体与数据选择动作

```rust
/// Represents the state of a queued upload.
enum UploadState {
    Waiting,
    Sending,
    Failed { attempts: u8 },
}

/// Returns a short action based on the upload state.
fn next_action(state: UploadState) -> &'static str {
    match state {
        UploadState::Waiting => "send",
        UploadState::Sending => "wait",
        UploadState::Failed { attempts } => {
            if attempts == 0 {
                "start"
            } else {
                "retry"
            }
        }
    }
}

/// Prints the actions for two upload states.
fn main() {
    println!("{}", next_action(UploadState::Failed { attempts: 0 }));
    println!("{}", next_action(UploadState::Failed { attempts: 2 }));
}
```

预测输出。再说明为什么 `attempts` 能在 `Failed` arm 中使用，而其他两个变体没有这个字段。

**契约：** 两行依次为 `start` 和 `retry`；解释 `attempts` 属于命名数据变体，arm 的模式负责绑定它。

**分层提示：** ① 两次调用都构造哪个变体？② 跟踪传入的计数。③ 分别代入相等比较的两侧。

## 2. 修复：覆盖新增状态

```rust
/// Represents three outcomes for an item.
enum Outcome {
    Pending,
    Accepted,
    Rejected,
}

/// Reports whether processing has finished.
fn is_done(outcome: Outcome) -> bool {
    match outcome {
        Outcome::Accepted => true,
    }
}

/// Prints a completion result.
fn main() {
    println!("{}", is_done(Outcome::Pending));
}
```

修复 `match`，使三种状态都显式得到处理：`Pending` 返回 `false`，`Accepted` 与 `Rejected` 返回 `true`。保留全部枚举变体和函数签名；不要添加通配 arm。

**契约：** 正常方案能通过 `cargo check`；另一个单独的错误变体应故意漏掉 `Rejected`，并能由编译器以穷尽性诊断拒绝。

**分层提示：** ① 对照枚举列出三种可能。② `match` 里目前出现几种？③ 给每种状态补一条返回布尔值的 arm。

## 3. 实现：为任务状态选择下一步

实现 `JobState` 的 `next_action`。待处理任务返回 `start`，运行中的任务返回 `wait`，完成任务返回 `none`。失败变体携带 `attempts: u8`：小于 3 次时返回 `retry`，达到 3 次或更多时返回 `inspect`。

```rust
/// Represents a job state with a retry counter for failures.
enum JobState {
    Pending,
    Running,
    Complete,
    Failed { attempts: u8 },
}

/// Selects the next action for every job state.
fn next_action(state: JobState) -> &'static str {
    // TODO: explicitly handle every variant and its retry boundary.
    todo!()
}
```

**契约：** 实现必须显式匹配四个变体；`Failed { attempts: 0 }` 与 `{ attempts: 2 }` 返回 `retry`，`{ attempts: 3 }` 与 `{ attempts: u8::MAX }` 返回 `inspect`。其他三种变体分别返回规定标签。

**分层提示：** ① 先列出四个变体。② 用 `Failed { attempts }` 绑定计数。③ 在该 arm 内比较 `attempts < 3`，边界 3 不属于重试。
