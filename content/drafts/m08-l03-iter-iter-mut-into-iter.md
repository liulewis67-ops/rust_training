# M08-L03：iter、iter_mut 与 into_iter

## 学完后

- 说出 Vec 上 iter、iter_mut、into_iter 分别产出什么类型的元素。
- 选择只读借用、可变借用或所有权转移来遍历集合。
- 验证遍历后原 Vec 是否还能使用，以及可变访问结束后如何继续使用。
- 解释 for value in collection 与 for value in &collection 的所有权差别。

## 先修

实施制作顺序依赖 M08-L02；概念上需要熟悉借用、可变借用、所有权移动、Vec 和 for 循环。本稿仍为私有预写内容，M08-L02 正式验收、I06-F04 和 R2 尚未完成。

## iter：逐个借用读取

Vec::iter 返回共享引用的迭代器，元素类型是 &T。遍历不会移动元素离开 Vec；借用持续到迭代器或引用不再使用时。若需求只是检查现有值，不需要先 clone 一份：

~~~rust
/// Reads labels through shared references and keeps the vector usable.
fn main() {
    let labels = vec![String::from("queued"), String::from("ready")];
    let mut iter = labels.iter();

    assert_eq!(iter.next().map(String::as_str), Some("queued"));
    assert_eq!(iter.next().map(String::as_str), Some("ready"));
    assert_eq!(iter.next(), None);
    assert_eq!(labels.len(), 2);
    assert_eq!(labels[0], "queued");
}
~~~

此处 iter.next() 的类型是 Option<&String>。迭代器必须是 mut，因为每次 next 都推进迭代位置；这和元素是否可变是两回事。迭代器走完后，labels 仍拥有两个 String。

## iter_mut：逐个可变借用

Vec::iter_mut 返回 &mut T。它适合原地更新每个元素，不需要另建一份同规模集合。持有这些可变引用期间，Vec 已被独占借用，不能同时通过别的引用读取或改变同一元素；for 循环结束、借用不再活跃后，调用方可以继续访问集合：

~~~rust
/// Adds a suffix to each label through exclusive element borrows.
fn main() {
    let mut labels = vec![String::from("queued"), String::from("ready")];

    for label in labels.iter_mut() {
        label.push('!');
    }

    assert_eq!(
        labels,
        vec![String::from("queued!"), String::from("ready!")]
    );
}
~~~

迭代器产生的每个可变引用都是临时访问权限，不改变集合本身的拥有者。iter_mut 不会把元素移出 Vec；更新结束后，labels 仍是原集合，只是内容已修改。

## into_iter：消费集合并取得元素

Vec::into_iter 获取 Vec 的所有权并逐个产出拥有的 T。使用它之后，原 Vec 不能再被读取；元素则可以转交给新的拥有者。以下代码没有要求 Label 实现 Clone，也没有复制元素：

~~~rust
/// Owns a label that deliberately does not implement Clone.
#[derive(Debug, PartialEq)]
struct Label(String);

/// Transfers every label from the input vector into a result vector.
fn transfer_labels(labels: Vec<Label>) -> Vec<Label> {
    let mut transferred = Vec::with_capacity(labels.len());
    for label in labels.into_iter() {
        transferred.push(label);
    }
    transferred
}

/// Verifies that owned values can be transferred without cloning.
fn main() {
    let labels = vec![Label(String::from("queued")), Label(String::from("ready"))];
    let transferred = transfer_labels(labels);
    assert_eq!(
        transferred,
        vec![Label(String::from("queued")), Label(String::from("ready"))]
    );
}
~~~

labels 在调用处被移动到 transfer_labels；函数消费 Vec 并把每个 Label 移进返回的 Vec。调用方不能继续使用旧绑定 labels，但可以使用返回的 transferred。没有 Clone 实现是有意的：若代码试图复制 Label，编译器会拒绝。

下面是故意错误的完整例子：into_iter 已经消费了 values，之后再用 values 会得到 E0382。

~~~rust
/// Intentionally invalid: values is used after it is consumed.
fn main() {
    let values = vec![String::from("one")];
    let iter = values.into_iter();
    assert_eq!(iter.count(), 1);
    assert_eq!(values.len(), 1);
}
~~~

## for 循环采用相同所有权规则

- for item in items：按值调用 IntoIterator；对 Vec<T> 消费集合，item 是 T。
- for item in &items：借用 Vec；item 是 &T，原集合可在共享借用结束后继续用。
- for item in &mut items：可变借用 Vec；item 是 &mut T，循环后集合仍存在且可继续访问。

三种写法不是通过复制出一份集合来迭代。它们选择的是迭代器的所有权和元素类型。需要保留集合时，从 &Vec 或 &mut Vec 开始；确定当前函数应该接管数据时，再接收 Vec 并消费它。直接调用 iter/iter_mut/into_iter 能让选择更加明确。

## 分层提示

1. **类型提示**：在循环里写出 item 的完整引用形式：T、&T 还是 &mut T？
2. **所有权提示**：迭代器由 Vec、&Vec 还是 &mut Vec 产生？谁拥有集合？
3. **后续使用提示**：原变量还要被使用吗？若要修改，是改元素还是改集合长度？
4. **参考方案**：将 Vec::iter、Vec::iter_mut、Vec::into_iter 的 Item 依次填为 &T、&mut T、T。

## 来源

- [The Rust Programming Language：Iterators](https://doc.rust-lang.org/book/ch13-02-iterators.html)
- [Rust 标准库：IntoIterator](https://doc.rust-lang.org/std/iter/trait.IntoIterator.html)
- [Rust 标准库：Vec](https://doc.rust-lang.org/std/vec/struct.Vec.html)

课程例子与练习为原创；官方来源用于核对引用类型、IntoIterator 实现与集合所有权转移。
