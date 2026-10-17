# M05-L04：可变借用冲突与 API 设计练习

先完成每题，再展开文末的公开参考答案。依赖 M05-L03。

## 1. 修复：读取后追加，保留两步行为

~~~rust
/// Reads a title and then appends another one.
fn main() {
    let mut titles = vec![String::from("queued")];
    let current = &titles[0];
    titles.push(String::from("sent"));
    println!("current: {current}");
    println!("count: {}", titles.len());
}
~~~

程序因 E0502 失败。修复它，先输出 current: queued，再追加条目并输出 count: 2。保留读取、push 和两个输出；不得克隆整个 Vec。

**契约：** 修复版编译且输出顺序正确；解释共享引用最后使用位置为何与 push 冲突，及你的修改如何消除重叠。

**分层提示：** ① 找到 current 最后一次使用。② 若业务还要显示文本，把该读取移到 push 前。③ 也可用显式作用域标出共享读取结束。

## 2. 实现：提取摘要后独占修改

补全函数：titles 保证至少含一项。先取得原首项的 UTF-8 字节数，再追加 next，返回旧首项字节数与新列表长度。

~~~rust
/// Appends a title and reports a copied summary of the previous first title.
fn append_and_measure(titles: &mut Vec<String>, next: String) -> (usize, usize) {
    // TODO: Read the old first title's length, then append next.
    todo!()
}

/// Retains ownership of and inspects the updated collection.
fn main() {
    let mut titles = vec![String::from("任务")];
    let (old_bytes, count) = append_and_measure(&mut titles, String::from("done"));
    println!("old bytes: {old_bytes}; count: {count}");
    println!("new: {}", titles[1]);
}
~~~

**契约：** 输出 old bytes: 6; count: 2 和 new: done；不得克隆 titles 或其旧首项；返回的摘要为整数而不是字符串引用，调用方继续拥有更新后的列表。

**分层提示：** ① 用一个短作用域共享借用 titles[0]。② 读取 .len() 得到 usize。③ 作用域结束后 push(next) 并返回 (old_bytes, titles.len())。

## 3. 设计评审：容器和元素不能同时别名借用

已知调用方需要向队列追加一个新标题，并随后查看队列。开发者建议：

~~~text
fn append_existing(items: &mut Vec<String>, source: &String);
~~~

调用方想写：

~~~rust
fn append_existing(items: &mut Vec<String>, source: &String) {
    println!("existing title: {source}");
    items.push(String::from("another"));
}

fn main() {
    let mut items = vec![String::from("draft")];
    let source = &items[0];
    append_existing(&mut items, source);
}
~~~

评审此 API：

1. 说明两个参数实际会如何访问 items，以及冲突在哪里。
2. 给出一个不克隆整个 Vec 的修订签名，让函数接收待追加的 owned String。
3. 若另一种业务只需在一个标题末尾加 marker、不改变列表长度，写出更窄的独占参数类型。
4. 说明何时克隆一个元素可能属于业务契约，为什么不能把 clone 整个集合当通用修复。

**契约：** 指出 items 同时被 &mut 和其元素的 &String 引用；给出 (items: &mut Vec<String>, next: String) 与 title: &mut String、marker: &str 两类签名；不主张删除业务行为或全局克隆。

**分层提示：** ① 把每个实参指向的数据画出来。② 一个参数借用整个 Vec，另一个借用 Vec 内部元素。③ 根据“追加条目”与“更新元素”分别选择 API。

## 参考答案

1. 把 `println!("current: {current}");` 移到 `titles.push(...)` 之前。共享读取先完成后，可再独占修改 Vec；不必克隆集合。
2. 先提取不借用列表的整数摘要，再追加：

   ```rust
   let old_bytes = titles[0].len();
   titles.push(next);
   (old_bytes, titles.len())
   ```

   `usize` 不引用旧标题，因此列表修改后仍可返回。`任务` 占 6 个 UTF-8 字节。
3. 追加 API 可接收 `(items: &mut Vec<String>, next: String)`，写入单个现有标题可收窄为 `title: &mut String` 与 `marker: &str`。两个场景都不需要同时传入 Vec 和其元素的共享引用。只有业务要求保留两个独立拥有的副本时才克隆那一个元素；不应为通用消除借用冲突而克隆整个 Vec。
