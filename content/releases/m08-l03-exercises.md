# M08-L03 练习：iter、iter_mut 与 into_iter

## 1. 预测：循环中的元素是谁拥有

~~~rust
/// Reads items by shared borrow and then consumes a separate vector.
fn main() {
    let borrowed = vec![String::from("red"), String::from("blue")];
    let mut observed = Vec::new();
    for color in &borrowed {
        observed.push(color.len());
    }

    let owned = vec![String::from("left"), String::from("right")];
    let mut moved = Vec::new();
    for side in owned {
        moved.push(side);
    }

    assert_eq!(borrowed.len(), 2);
    assert_eq!(observed, vec![3, 4]);
    assert_eq!(moved, vec![String::from("left"), String::from("right")]);
}
~~~

说明两个循环中的元素类型，预测代码是否编译；调用方还能否访问 owned？输出 moved 是否需要克隆 String？

**提示**：for 循环会将循环表达式转换为 IntoIterator。表达式是 &borrowed 还是 owned，决定对应的实现。

**验证契约**：代码编译运行通过；第一个循环得到 &String 并保留 borrowed，第二个循环得到 String 并消费 owned；元素移动进 moved，无需 Clone。

## 2. 修复：原地修改元素

修复 suffix_all，让它给每个字符串追加字符。函数接收可变切片，但不得复制或消费其中的 String。

~~~rust
/// Adds a suffix to each element without consuming the slice.
fn suffix_all(labels: &mut [String]) {
    for label in labels.iter() {
        label.push('!');
    }
}

/// Checks in-place updates and collection reuse.
fn main() {
    let mut labels = vec![String::from("a"), String::from("b")];
    suffix_all(&mut labels);
    assert_eq!(labels, vec![String::from("a!"), String::from("b!")]);
}
~~~

**提示**：iter 的元素是共享引用；String::push 需要怎样的访问？比较 iter 与 iter_mut。

**验证契约**：原实现因不能通过 &String 修改内容而以 E0596 失败；改用 iter_mut 后编译运行通过，labels 仍可读取且内容已更新。

## 3. 补测试：消费后转移非 Clone 项目

下面的传递函数已经完成；请补齐测试断言，证明迭代过程中没有要求 Label 克隆、输入所有权已被消费、返回值顺序与内容正确。不要给 Label 派生 Clone。

~~~rust
/// Owns a tag and intentionally does not implement Clone.
#[derive(Debug, PartialEq)]
struct Label(String);

/// Transfers all labels to a new vector by value.
fn transfer(labels: Vec<Label>) -> Vec<Label> {
    let mut result = Vec::new();
    for label in labels.into_iter() {
        result.push(label);
    }
    result
}

/// Completes checks for ownership transfer and order.
fn main() {
    let input = vec![Label(String::from("alpha")), Label(String::from("beta"))];
    let output = transfer(input);

    // TODO: assert the output has two labels in the original order
    // TODO: assert the labels are alpha and beta
}
~~~

**提示**：Label 只有 Debug 与 PartialEq，因此通过比较 Vec<Label> 即可校验顺序和内容；测试调用 transfer 后不应再使用 input。

**验证契约**：补全后以 Rust 1.95.0、Edition 2024 编译运行通过；output 顺序为 alpha、beta；Label 无 Clone 实现，验证路径确实采用所有权移动。

## 4. 边界迁移：三种迭代中的所有权证据

先标出三种迭代项分别是 `&String`、`&mut String`、`String`，运行三个测试，再编译反例记录 E0382。分别用借用迭代和提前提取所需信息修复；解释在何种需求下仍应使用 `into_iter()` 而非一律避免消费。

**验收：** 执行 `cargo +1.95.0 test --offline --manifest-path content/samples/verified-lesson-drills/Cargo.toml m08_iteration::`，分别提交测试结果与反例诊断，并说明为何此方案保留了函数与调用方的原始契约。

## 参考答案

1. `for color in &borrowed` 得到 `&String`，原集合仍有效；`for side in owned` 得到拥有的 `String`，消耗 `owned`，移动到 `moved` 不需克隆。
2. 修改元素必须使用独占访问：

   ```rust
   fn suffix_all(labels: &mut [String]) {
       for label in labels.iter_mut() {
           label.push('!');
       }
   }
   ```

3. 对非 `Clone` 项目的消费，采用 `into_iter` 转移原值；测试应在遍历后读取新集合，而不是移动后的旧集合。

请特别说明编译失败来自所有权或可变借用规则，而非“必须加 clone”。

## 来源

- [The Rust Programming Language](https://doc.rust-lang.org/book/)
