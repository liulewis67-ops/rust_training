# M03-L04 三道短练习草案

状态：课前草稿；依赖 M03-L03，尚未经过 R1、平台或独立学习者验收。

## 1. 修复：让调用方通过公开 API 工作

```rust
/// Exposes task operations while hiding internal state.
pub mod task_api {
    enum State {
        Open,
        Closed,
    }

    pub struct Task {
        state: State,
    }

    impl Task {
        /// Creates an open task.
        pub fn new() -> Self {
            Self { state: State::Open }
        }

        /// Closes the task for outside callers.
        pub fn close(&mut self) {
            self.state = State::Closed;
        }

        /// Reports whether the task is closed.
        pub fn is_closed(&self) -> bool {
            matches!(self.state, State::Closed)
        }
    }
}

/// Uses the task from a sibling module.
mod client {
    pub fn run() {
        let mut task = crate::task_api::Task::new();
        task.state = crate::task_api::State::Closed;
        println!("{}", task.is_closed());
    }
}

fn main() {
    client::run();
}
```

修正 client，使其不访问私有字段或私有枚举，仍然关闭任务并输出 `true`。保持 `Task.state` 与 `State` 私有，不要为了通过编译把它们公开。

**契约：** 正确版本编译并输出 `true`；错误版本命中隐私边界诊断；修复后不再引用 `state` 或 `State`。

**分层提示：** ① 查找模块作者已经公开的状态操作。② 调用该操作，而非直接构造状态。③ 用查询方法读取结果。

## 2. 实现：完成一个封装计数器

补全 `Counter` 的公开构造、读取和递增接口。内部数值字段必须保持私有。

```rust
/// Exposes controlled operations for a counter.
pub mod counter {
    pub struct Counter {
        value: u16,
    }

    impl Counter {
        /// Creates a counter at the requested value.
        pub fn new(value: u16) -> Self {
            todo!()
        }

        /// Reads the current value.
        pub fn value(&self) -> u16 {
            todo!()
        }

        /// Advances the counter once unless it is already at u16::MAX.
        pub fn advance(&mut self) {
            todo!()
        }
    }
}
```

**契约：** `Counter::new(4)` 初值为 4；调用一次 `advance()` 后 `value()` 返回 5；连续两次后返回 6；若初值为 `u16::MAX`，调用后保持最大值。字段 `value` 不能公开，也不能改为不受控的外部读写。

**分层提示：** ① 构造函数返回含初始值的 `Self`。② 只读方法返回字段。③ 修改方法使用 `&mut self`，先判断是否已到上限再递增。

## 3. 设计评审：缩小任务接口

```rust
/// Publishes every ticket detail to all callers.
pub mod tickets {
    pub struct Ticket {
        pub id: u32,
        pub is_closed: bool,
        pub internal_note_count: u16,
    }
}
```

团队希望调用方可以创建任务、读取稳定编号、查询是否关闭并请求关闭任务；内部备注计数只用于实现。指出当前设计至少两个接口风险，并画出或写出一组更小的公开 API。说明哪些成员公开、哪些状态保留私有，以及调用方如何完成四项需求。

**契约：** 评审覆盖公开可变状态字段、内部实现数据外泄、所需公开操作是否齐备；允许多种合理签名，但不得要求调用方直接写状态字段来执行关闭。

**分层提示：** ① 哪些字段允许调用方任意改写？② 内部计数是否属于调用方需求？③ 把关闭设计为受控方法，并提供查询状态的方法。
