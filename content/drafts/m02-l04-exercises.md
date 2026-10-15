# M02-L04 三道短练习草案

状态：课前草稿；依赖 M02-L03，尚未接入课程目录或 R1。

## 1. 修复：数组最后一个元素

```rust
/// Adds each value in a three-element array.
fn sum_values(values: [i32; 3]) -> i32 {
    let mut total = 0;
    for index in 0..=values.len() {
        total += values[index];
    }
    total
}

/// Prints the sum of three measurements.
fn main() {
    println!("{}", sum_values([4, 7, 2]));
}
```

修复循环的范围，使 `sum_values([4, 7, 2])` 返回 `13`，且不会因访问长度位置而 panic。保留数组下标访问，并解释循环实际访问的下标。

**契约：** 必须访问下标 `0`、`1`、`2` 各一次；不能移除循环、硬编码总和或改写为常量返回。

**分层提示：** ① 长度是多少，最后有效下标是多少？② `0..=` 会不会包含右端点？③ 用排除上界的范围遍历所有有效下标。

## 2. 实现：解构固定读数并分类

实现 `summarize_readings`：输入是三个 `i32`，输出元组为“首项、末项、总和”；再用 `match` 把总和分类。总和在 `0..=10` 时返回 `small`，`11..=30` 返回 `medium`，其他值返回 `outside`。

```rust
/// Returns the endpoints and total of exactly three readings.
fn summarize_readings(readings: [u8; 3]) -> (u8, u8, u16) {
    // TODO: destructure the array and compute its total.
    todo!()
}

/// Classifies a total using the required inclusive bands.
fn total_band(total: u16) -> &'static str {
    // TODO: cover every possible i32 input with match patterns.
    todo!()
}

/// Displays one valid summary and one classification.
fn main() {
    let (first, last, total) = summarize_readings([2, 3, 4]);
    println!("{first}, {last}, {total}: {}", total_band(total));
}
```

**契约：** 对 `[2, 3, 4]` 返回 `(2, 4, 9)`；用 `u16::from` 累加三个 `u8`，以避免总和溢出；对总和 `10`、`11`、`30`、`31` 分别分类为 `small`、`medium`、`medium`、`outside`。解构时不得假定数组长度可变。

**分层提示：** ① 用 `[first, _, last]` 绑定端点。② 总和是三个元素相加。③ `match` 范围两端均包含，最后补 `_`。

## 3. 设计评审：让位置契约可以核对

评审下列 API 设计：调用方读取固定传感器组中的指定位置，调用约定写着“位置从零开始，最大合法位置是 2”。

```rust
/// Returns one reading selected by its zero-based position.
fn reading_at(readings: [i32; 3], position: usize) -> i32 {
    readings[position]
}
```

说明 `position == 0`、`position == 2` 和 `position == 3` 各自会发生什么；指出文档约定和代码本身是否一致，以及调用者怎样才能不越界。最后列出至少三个边界测试输入，并写出预期结果或行为。

**契约：** 必须区分合法的首项、合法的末项与等于数组长度的非法位置；需要指出当前函数没有主动检查契约，位置 3 会在索引时 panic。测试建议至少覆盖 0、2、3。

**分层提示：** ① 三元素数组的有效位置区间是什么？② Rust 数组索引如何处理越界？③ 文档约定如何落实为参数检查或调用方约束？
