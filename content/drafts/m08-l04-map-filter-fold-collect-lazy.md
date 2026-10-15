# M08-L04：map/filter/fold、collect 与惰性

## 学完后

- 用 map 一对一转换元素，用 filter 选择满足条件的元素。
- 用 fold 从显式初始值逐项累积结果，并说明空输入的结果。
- 用 collect 消费转换后的迭代器并指定需要的结果集合。
- 解释 iterator adapter 的惰性，并修复“只创建 map 却期待它执行”的代码。
- 区分转换数据的 map 与执行副作用的 for_each / for 循环。

## 先修

实施制作顺序依赖 M08-L03；概念上需要理解闭包、迭代器所有权、借用和集合类型。本稿仍是私有预写内容，M08-L03 正式验收、I06-F04 与 R2 尚未完成。

## map 和 filter 描述逐项工作

map 为每个输入元素产生一个转换后的元素；filter 保留谓词为真的元素。二者是 iterator adapter：创建它们会描述处理步骤，但不会自动遍历。以下例子先选择非负数，再把选中项放大十倍，collect 最后才真正消费迭代器并建成 Vec：

~~~rust
/// Keeps non-negative values and scales each selected value.
fn select_scaled(values: &[i32]) -> Vec<i32> {
    values
        .iter()
        .filter(|&&value| value >= 0)
        .map(|&value| value * 10)
        .collect()
}

/// Checks filtering, mapping, empty input, and source reuse.
fn main() {
    let values = vec![-2, 0, 3];
    assert_eq!(select_scaled(&values), vec![0, 30]);
    assert_eq!(select_scaled(&[]), Vec::<i32>::new());
    assert_eq!(values, vec![-2, 0, 3]);
}
~~~

因为输入用 iter 借用，collect 出来的整数 Vec 与来源相互独立；这里没有复制原集合的过程，map 直接产生新的 i32。filter 闭包接收对当前迭代项的引用，所以这里用 &&value 解构 Iterator<Item = &i32> 经 filter 的谓词参数；map 则拿到 &i32。熟悉类型后也可以写显式解引用形式。

## fold 让累积状态与空值行为明确

fold 接收初始累积值和更新累积值的闭包。它会消费迭代器，每一步把当前 accumulator 与一个元素组合为下一份 accumulator。初始值来自调用方，因此空输入直接返回初始值：

~~~rust
/// Adds every value to an explicit running total.
fn total(values: &[i32]) -> i32 {
    values.iter().fold(0, |sum, value| sum + *value)
}

/// Checks non-empty and empty folds.
fn main() {
    assert_eq!(total(&[3, -1, 5]), 7);
    assert_eq!(total(&[]), 0);
}
~~~

0 是本例所选的初始和，也让空列表的结果自然成为 0。若累积业务状态不能用一个清楚的初始值表达，或闭包会令代码更难读，普通 for 循环也可以显式更新 accumulator。不要为了“函数式”而把容易理解的循环强行折叠。

## adapter 惰性：没有消费就不执行

单独创建 map 并丢弃结果，不会调用转换闭包。下面的计数器证明 pending 迭代器没有跑过；collect 消费另一个 map 后，闭包才对每个输入执行：

~~~rust
/// Demonstrates that adapter work starts only when an iterator is consumed.
fn main() {
    let values = [2, 4, 6];
    let mut calls = 0;

    {
        let pending = values.iter().map(|value| {
            calls += 1;
            *value * 2
        });
        drop(pending);
    }
    assert_eq!(calls, 0);

    let doubled: Vec<i32> = values
        .iter()
        .map(|value| {
            calls += 1;
            *value * 2
        })
        .collect();
    assert_eq!(doubled, vec![4, 8, 12]);
    assert_eq!(calls, 3);
}
~~~

常见消费操作包括 collect、fold、sum、for_each，以及 for 循环。collect 消费迭代器并由目标类型决定构建哪一种集合；用类型标注或 turbofish 说明目标，可避免类型无法推断。迭代器的 adapter 链可以按需组合，但是否运行仍由消费端决定。

若 map 的唯一目的，是在遍历期间修改外部状态或打印，而不产生有用的新元素，应使用 for_each 或普通 for 循环。这样调用意图更直观，也不会把返回的 map 迭代器无声丢弃。

## 读取错误的副作用方案

~~~rust
/// Intentionally wrong: map is created and discarded without being consumed.
fn main() {
    let values = [1, 2];
    let mut output = Vec::new();

    values.iter().map(|value| output.push(value * 2));
    assert_eq!(output, vec![2, 4]);
}
~~~

这个程序能编译，但断言失败：map 的 closure 从未运行，output 仍为空。默认 lint 会提示丢弃 must-use 的 Map 结果；课程评测不能把“只编译通过”当成达成了转换契约。修复方式是把 map 结果交给 collect，或者因为目的仅是副作用而改用 for_each / for。

## 分层提示

1. **逐项提示**：输出与输入一一对应吗？需要删除某些元素吗？分别对应 map 还是 filter？
2. **累积提示**：fold 初始值是什么？对空输入而言该结果是否有意义？
3. **惰性提示**：闭包在哪个 consumer 被调用？adapter 是否被保存、消费或丢弃？
4. **返回类型提示**：需要新集合时明确 collect 目标类型；只做副作用时考虑 for_each 或 for。
5. **参考方案**：用独立的正确性断言验证最终元素；计数器断言应显示丢弃 map 时为 0、collect 后为输入元素数。

## 来源

- [The Rust Programming Language：Iterators](https://doc.rust-lang.org/book/ch13-02-iterators.html)
- [标准库：Iterator](https://doc.rust-lang.org/std/iter/trait.Iterator.html)
- [标准库：迭代器适配与惰性](https://doc.rust-lang.org/std/iter/)

课程例子与习题为原创；官方来源用于核对 adapter/consumer 区别、fold 初值语义及 collect 的目标类型推断。
