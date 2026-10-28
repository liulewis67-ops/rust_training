# M08-L04 练习：map/filter/fold、collect 与惰性

## 1. 修复：map 没有运行

修复 apply_twice，使它实际把每个数乘二并把结果返回。保持输入切片不变，并让输出类型清楚。

~~~rust
/// Attempts to double each input value.
fn apply_twice(values: &[i32]) -> Vec<i32> {
    let mut output = Vec::new();
    values.iter().map(|value| output.push(value * 2));
    output
}

/// Checks that all input values were transformed.
fn main() {
    assert_eq!(apply_twice(&[1, 2]), vec![2, 4]);
}
~~~

**提示**：map 产生的是另一个迭代器。要构造 Vec，应该让输出元素成为 collect 消费的项，而不是把 push 的返回值拿去 map。

**验证契约**：原方案编译时有未使用 Map 的警告且运行断言失败，因为 output 为空；正确方案返回 values.iter().map(|value| *value * 2).collect::<Vec<_>>()，结果为 [2, 4]。

## 2. 实现：对偶数求和

实现 even_total：跳过奇数，将所有偶数相加。使用 filter 和 fold；空输入结果为 0，重复偶数要各自计入。

~~~rust
/// Sums even values without changing the source slice.
fn even_total(values: &[i32]) -> i32 {
    // TODO: filter even values and fold them from zero
    0
}

/// Checks empty, duplicate, positive, and negative values.
fn main() {
    assert_eq!(even_total(&[]), 0);
    assert_eq!(even_total(&[2, 2, 3, -4]), 0);
    assert_eq!(even_total(&[2, 2, 3, -6]), -2);
}
~~~

**提示**：fold 里的初始值用 0。filter 对迭代项做判断；切片 iter 产生 &i32，因此判断闭包需解引用或使用匹配模式。

**验证契约**：参考方案对空数据返回 0，对 [2, 2, 3, -6] 返回 -2；两个相同的 2 都需计入。实现不得消费或修改输入。

## 3. 设计评审：副作用还是数据转换

审查课程中的错误方案：map closure 调用 output.push(value * 2)，然后直接检查 output。回答：

1. 为什么它编译后仍没有转换任何元素？
2. 若调用方需要一个新 Vec，应该如何写？如果只需要打印每个值，应该用 map 吗？
3. 哪项可运行断言能够区分正确实现和只构造 adapter 后将其丢弃的实现？

**提示**：沿着 adapter 输出追踪是否有 consumer；把迭代器创建、消费和最终输出分别写在纸上。

**验证契约**：解释 map 是惰性 adapter，closure 只有 consumer 拉取元素才执行；新 Vec 场景用 map 加 collect 并检查结果等于期望 Vec；仅做副作用时选 for_each/for；还应有断言检查值而不只检查“无 panic”。答案不得以编译警告本身代替行为验证。

## 参考答案

1. `map` 是惰性适配器。转换结果需要作为迭代器的输出并被 `collect` 消费：

   ```rust
   fn apply_twice(values: &[i32]) -> Vec<i32> {
       values.iter().map(|value| *value * 2).collect()
   }
   ```

2. 从明确的 `0` 初始值汇总偶数：

   ```rust
   fn even_total(values: &[i32]) -> i32 {
       values
           .iter()
           .filter(|value| **value % 2 == 0)
           .fold(0, |sum, value| sum + value)
   }
   ```

3. 只执行打印或日志副作用时选 `for` / `for_each`。仅创建但不消费 `map` 不会执行闭包；以行为断言而不是 warning 判断结果。

## 来源

- [The Rust Programming Language](https://doc.rust-lang.org/book/)
