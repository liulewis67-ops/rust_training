# M05-L02：借用有效范围与 NLL 直觉

## 学完后

- 区分绑定的词法作用域与引用实际仍会被使用的借用范围。
- 移动共享引用的最后一次使用，预测共享/独占借用是否重叠。
- 根据固定工具链诊断识别借用冲突从何处开始、哪次读取使借用仍然有效。
- 用明确的控制流顺序安排读取和修改，而不是凭花括号位置推断所有借用区间。

## 先修

完成 M05-L01，能识别共享借用 `&T` 与独占借用 `&mut T`。本节使用 Edition 2024、Rust 1.95.0，并只聚焦引用的最后使用位置；不展开函数返回引用的生命周期省略或命名生命周期。

## 变量还在作用域中，借用可以已经结束

```rust
/// Uses a shared borrow before mutating the collection.
fn main() {
    let mut names = vec![String::from("Ada")];
    let first = &names[0];
    println!("first: {first}");
    names.push(String::from("Lin"));
    println!("count: {}", names.len());
}
```

这段程序可以编译，输出 `first: Ada` 与 `count: 2`。`first` 这个绑定的词法作用域延续到 `main` 结束，但引用的最后一次使用已经在 `println!("first: ...")`。之后的 `push` 可以独占修改 `names`；变量仍在词法作用域内，不代表它此前借出的引用必须继续有效。

借用检查按引用是否可能继续被程序使用来确定有效范围。非词法生命周期（NLL）允许借用在最后一次使用之后结束，而不必等持有引用的变量离开花括号。这个例子不是“所有借用总在最后一次文本出现处结束”的语法替换规则；控制流必须保证那之后确实没有需要该引用的路径。

## 把最后一次读取移到修改之后会冲突

```rust
/// Tries to use a shared reference after mutating its owner.
fn main() {
    let mut names = vec![String::from("Ada")];
    let first = &names[0];
    names.push(String::from("Lin"));
    println!("first: {first}");
}
```

这段代码会触发 E0502。诊断会指向 `push` 对 `names` 的可变借用，并指出之后仍要通过 `first` 读取 `names`。把最后一条 `println!` 移到 `push` 之前，借用即可先结束；或者把读取放入先结束的内层作用域。不能只看 `first` 声明在哪个花括号里，就认定冲突覆盖整个词法作用域；同样也不能忽略之后仍有引用使用。

```text
词法作用域：first 从声明处一直可见到 main 结束

版本 A 的借用使用：
  共享借用 first ──最后读取──┆独占 push──────────────────
                           借用已结束，修改可行

版本 B 的借用使用：
  共享借用 first ─────────────独占 push────最后读取 first
                              冲突：借用仍需被使用
```

## 用输出次序修复，而不是只消除报错

如果业务要求先展示旧的第一个名称，再追加一项并展示新数量，应把那次读取安排在修改之前：

```rust
/// Reads the first name, then appends another name.
fn main() {
    let mut names = vec![String::from("Ada")];
    let first = &names[0];
    println!("first: {first}");
    names.push(String::from("Lin"));
    println!("count: {}", names.len());
}
```

修复保留了两项业务步骤和输出；共享引用最后使用后，才开始可变修改。删掉读取或删掉追加操作虽然也会去掉冲突，却没有履行原契约。

## 检查顺序

1. 标出引用绑定的词法作用域，但不要把它直接等同于借用有效期。
2. 找出引用在所有可能执行路径上的最后一次需要使用的位置。
3. 标出随后对 owner 的修改或独占借用，并检查它之前是否还有共享引用使用。
4. 将冲突诊断对应到借用创建点和后续读取点，确认是哪条引用仍活跃。
5. 修复时保留全部业务输出，先完成读取，再修改；之后运行原始契约检查。

## 来源

- [The Rust Programming Language：References and Borrowing](https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html)
- [The Rust Reference：Borrow operators](https://doc.rust-lang.org/reference/expressions/operator-expr.html#borrow-operators)

正文、时间线图、变式和行为契约为原创；来源用于核对最后使用位置与借用检查的关系、共享/独占引用限制。
