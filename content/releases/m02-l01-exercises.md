# M02-L01：变量、可变性与类型练习

## 1. 预测：哪些赋值可以编译？

```rust
/// Demonstrates mutation and shadowing for a prediction exercise.
fn main() {
    let retries = 2;
    let mut remaining = retries;
    remaining -= 1;
    let retries = remaining;
    println!("{retries}");
}
```

说明每个名字的类型、哪一个绑定被重新赋值、哪一行创建了新绑定，并预测输出。随后把最后一次 `let retries = remaining;` 改为 `retries = remaining;`，预测编译结果并解释原因。

**契约：** 回答须区分 `mut` 重新赋值与 `let` 再绑定；只写最终数字不满足要求。

**分层提示：** ① 找出每次出现的 `let`。② 标出是否带 `mut`。③ 判断两种同名语句是否为同一绑定。

## 2. 修复：按接口保留类型边界

```rust
/// Demonstrates a type mismatch for a repair exercise.
fn main() {
    let discount_percent: u8 = 15;
    let report_value: i64 = discount_percent;
    println!("{report_value}");
}
```

修复编译错误，保持 `discount_percent` 的 `u8` 类型和 `report_value` 的 `i64` 类型不变。解释为何修复是显式且合法的，并说明仅把源变量改成 `mut` 为什么无效。

**契约：** 两个声明类型保持不变，程序编译并输出 `15`；不得通过删除类型约束或把两端改成相同类型绕过问题。

**分层提示：** ① 诊断指出赋值两侧类型不同。② 查询标准库提供的无损转换。③ 在赋值处明确表达转换。

## 3. 实现：把分钟与秒组成总秒数

实现下面函数，输入契约规定 `seconds < 60`，`minutes <= 1_000`。返回分钟和秒合成的总秒数，结果类型为 `u32`。

```rust
/// Converts a minute-and-second pair into total seconds under the stated bounds.
fn total_seconds(minutes: u16, seconds: u8) -> u32 {
    // TODO: implement without changing the signature.
    todo!()
}
```

**契约：** `(2, 5)` 得到 `125`，`(0, 59)` 得到 `59`；保留签名，使用清晰的整数运算，不使用浮点数，不修改公开契约。

**分层提示：** ① 每分钟有 60 秒。② 先把分钟转换为结果类型，再乘 60。③ 把秒也显式转换后相加。

这道题只覆盖类型选择与显式转换；非法秒值的输入校验留给后续控制流/边界处理单元。

## 参考答案

1. `retries` 起初是不可变 `i32`，`remaining` 是可变 `i32`；递减后 `remaining` 为 1。`let retries = remaining` 创建了新的同名绑定并输出 `1`。若改成赋值语句 `retries = remaining`，原绑定不可变，编译失败。
2. 写成 `let report_value: i64 = i64::from(discount_percent);`。`mut` 只允许重新赋值，不会把 `u8` 转换成 `i64`。
3. `fn total_seconds(minutes: u16, seconds: u8) -> u32 { u32::from(minutes) * 60 + u32::from(seconds) }`。结果是 `125` 和 `59`。
