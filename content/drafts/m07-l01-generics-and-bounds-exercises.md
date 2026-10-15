# M07-L01 练习：泛型与约束

## 1. 预测：同一函数的具体实例

```rust
fn choose<T: PartialOrd>(left: T, right: T) -> T {
    if left <= right { left } else { right }
}

fn main() {
    assert_eq!(choose(3_i16, 9_i16), 3);
    assert_eq!(choose(String::from("elm"), String::from("ash")), "ash");
}
```

说明两次调用分别将 `T` 推断为什么；预测两项比较和结果。解释为什么可以复用一个定义，以及这是否表示两个类型在运行时混在同一次调用中。

**提示**：按调用点分别代入 `T`，并确认具体类型满足 `PartialOrd`。

**验证契约**：Rust 1.95.0、Edition 2024 编译运行通过；两项断言成立。解释须说明推断按调用实例发生，`T: PartialOrd` 使比较操作有保证。

## 2. 修复：补出真实需求

```rust
fn larger<T>(a: T, b: T) -> T {
    if a > b { a } else { b }
}
```

修改签名，使其对所有满足比较条件的类型成立。用 `i32` 和 `String` 调用验证。不要加入函数体没有使用的 `Clone` 或 `Copy`。

**提示**：错误位于泛型定义处；调用点当前恰好都是可比较类型，不会替任意 `T` 提供定义期证明。

**验证契约**：正确方案仅增加所需的排序 bound 并编译运行；加入 `T: PartialOrd` 的版本对两类输入都通过。未加 bound 的原定义在比较表达式处失败，编译器诊断文字可随工具链变化。

## 3. 实现：通用边界摘要

实现 `summarize`，克隆被引用的 `T` 值并返回格式化文本。要求 `T` 同时可克隆和显示；使用 `where` 子句。用 `u8` 与 `String` 各测一次。

```rust
fn summarize<T>(value: &T) -> String
where
    // TODO: add only the capabilities used below
{
    format!("item: {}", T::clone(value))
}
```

**提示**：使用 `T::clone(value)` 克隆被引用的值；`{}` 需要 Display。不要把 `&T` 自身的 Clone 和 `T: Clone` 混淆。

**验证契约**：`summarize(&5_u8) == "item: 5"`，`summarize(&String::from("oak")) == "item: oak"`；Rust 1.95.0、Edition 2024 测试通过。提交解释应分别将两个 bound 对应到实际操作。
