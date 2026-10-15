# M02-L02 三道短练习草案

状态：课前草稿；依赖 M02-L01，须后续映射到完整模块课包并通过 R1 执行。

## 1. 预测：表达式的值到哪里去了？

```rust
/// Adds a fixed adjustment using a block expression.
fn adjusted(base: i32) -> i32 {
    let fee = 4;
    base + fee
}

/// Prints the predicted result.
fn main() {
    let result = adjusted(8);
    println!("{result}");
}
```

预测程序输出，并标出 `let` 语句、函数调用和 `adjusted` 的尾表达式。再给 `base + fee` 加上分号，预测编译器会在哪个接口处报告什么类型冲突。

**契约：** 回答须说明尾表达式如何成为 `i32` 返回值，以及加分号后块值为何改变；只答 `12` 不满足要求。

**分层提示：** ① 找到每个代码块的最后一行。② 判断它是否有分号。③ 比较函数声明类型与块实际值类型。

## 2. 修复：让函数兑现返回契约

```rust
/// Returns the value one greater than the input.
fn plus_one(value: i32) -> i32 {
    value + 1;
}
```

修复函数，使 `plus_one(5)` 返回 `6`，保留签名，并解释原函数体为什么得到 `()`。可选方案是尾表达式或显式 `return`，请选择一种并说明。

**契约：** 签名保持不变，修复后能编译；不得以忽略结果、将返回类型改为 `()` 或硬编码输入样例的方式规避契约。

**分层提示：** ① 箭头声明要求结果类型为 `i32`。② 看分号是否把算式变成语句。③ 去掉分号或显式返回算式值。

## 3. 实现：计算长方体体积

实现下列函数。题目契约保证三个尺寸都不超过 100 厘米，因此乘积可由 `u32` 表示。

```rust
/// Returns a rectangular prism volume in cubic centimeters.
fn volume_cm3(width_cm: u32, height_cm: u32, depth_cm: u32) -> u32 {
    // TODO: implement using the three inputs.
    todo!()
}
```

**契约：** `volume_cm3(2, 3, 4)` 得到 `24`；任何一边为 0 时结果为 0；保留函数签名，不能硬编码示例答案。

**分层提示：** ① 体积是三个边长的乘积。② 让乘积表达式作为尾表达式。③ 检查每个参数都参与运算。
