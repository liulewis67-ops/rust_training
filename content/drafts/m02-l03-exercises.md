# M02-L03 三道短练习草案

状态：课前草稿；依赖 M02-L02，尚未接入课程目录或 R1。

## 1. 预测：分支值与条件类型

```rust
/// Chooses a message from the current queue size.
fn queue_message(size: u32) -> &'static str {
    if size == 0 {
        "empty"
    } else {
        "busy"
    }
}

/// Prints the message for a queue with two entries.
fn main() {
    println!("{}", queue_message(2));
}
```

预测输出，并说明 `if` 分支的值如何成为函数结果。再删去 `else` 块，预测编译结果；说明只省略“否则做什么”和让 `if` 产生 `&'static str` 是否相同。

**契约：** 回答须指出原程序输出 `busy`；删除 `else` 后表达式结果为 `()`，不能满足函数声明的 `&'static str` 返回类型。

**分层提示：** ① 先计算条件真假。② 读两个分支的尾表达式。③ 再判断省略 `else` 时，未命中条件的表达式值是什么。

## 2. 修复：让计数循环结束且次数准确

```rust
/// Counts down to zero and returns the number of iterations.
fn countdown_ticks(mut remaining: u32) -> u32 {
    let mut ticks = 0;
    while remaining > 0 {
        ticks += 1;
        // The loop must update the value used by its condition.
    }
    ticks
}
```

当前实现从正数开始时不会结束。修复循环，使 `countdown_ticks(3)` 返回 `3`，`countdown_ticks(0)` 返回 `0`。保留签名和 `while` 结构，并说明循环条件在哪一轮变为假。

**契约：** 每轮恰好递减一次 `remaining` 并增加一次 `ticks`；不能通过直接返回输入、改变初始值或移除循环来规避练习。

**分层提示：** ① 找到条件依赖的变量。② 在每轮末尾推进它。③ 检查零输入和正输入的停止路径。

## 3. 测试补全：验证包含上界的范围

实现如下函数后，补齐两个测试函数中的断言。函数契约限定 `limit <= 100`：

```rust
/// Sums the positive multiples of three up to an inclusive limit.
fn sum_multiples_of_three(limit: u32) -> u32 {
    let mut total = 0;
    for value in 1..=limit {
        if value % 3 == 0 {
            total += value;
        }
    }
    total
}

/// Verifies the empty-result boundary below the first multiple.
#[test]
fn returns_zero_when_no_value_matches() {
    // TODO: assert the result for limit 2.
}

/// Verifies that a matching inclusive upper bound is included.
#[test]
fn includes_a_matching_limit() {
    // TODO: assert the result for limit 9.
}
```

**契约：** 第一项测试验证 `2` 时结果为 `0`；第二项验证 `9` 被包含且结果为 `18`。两个测试都要调用函数，不得删除或忽略任一用例。

**分层提示：** ① 列出不超过 2 的正倍数。② 列出不超过 9 的正倍数。③ 求和并核对 `..=` 的上界规则。
