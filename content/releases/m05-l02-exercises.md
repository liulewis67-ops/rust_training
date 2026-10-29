# M05-L02：借用有效范围与 NLL 练习

先完成每题，再展开文末的公开参考答案。依赖 M05-L01。

## 1. 预测：读取后再追加

```rust
/// Reads a borrowed first item before mutating its collection.
fn main() {
    let mut queue = vec![String::from("one")];
    let first = &queue[0];
    println!("head: {first}");
    queue.push(String::from("two"));
    println!("length: {}", queue.len());
}
```

判断代码能否通过借用检查并写出输出。指出 `first` 绑定仍处于词法作用域内时，为什么 `queue.push` 仍可执行。

**契约：** 程序编译；输出为 `head: one`、`length: 2`；说明 `first` 最后一次使用早于可变修改。

**分层提示：** ① `push` 之前最后一次读取发生在哪里？② 后面是否还会用 `first`？③ 分开画绑定作用域与借用需要区间。

## 2. 修复：冲突诊断指向最后读取

```rust
/// Tries to read a queue item after pushing another item.
fn main() {
    let mut queue = vec![String::from("one")];
    let first = &queue[0];
    queue.push(String::from("two"));
    println!("head: {first}");
    println!("length: {}", queue.len());
}
```

程序因共享/独占借用冲突而失败。调整语句顺序，使输出为 `head: one`、`length: 2`；不得删除读取、追加或任一输出。解释哪一行的后移让 `first` 仍需保持有效。

**契约：** 正确解编译并按契约输出；原始解应产生 E0502；说明最后使用位置如何改变借用区间。

**分层提示：** ① 只需调换哪个表达式的位置？② 把 first 的读取放到 push 前。③ 在修改发生时，确认以后没有任何 first 的使用。

## 3. 实现：检查首项后追加新项

补全函数：队列保证非空。函数先打印当前首项，再添加新项，最后返回新长度。

```rust
/// Reads the first queued label, appends a label, and reports the new length.
fn append_after_read(queue: &mut Vec<String>, next: String) -> usize {
    // TODO: Read and print the current first item, then append next.
    todo!()
}

/// Calls the helper while retaining ownership of the queue.
fn main() {
    let mut queue = vec![String::from("one")];
    let length = append_after_read(&mut queue, String::from("two"));
    println!("length: {length}");
    println!("tail: {}", queue[1]);
}
```

**契约：** 输出 `head: one`、`length: 2`、`tail: two`；只读首项后结束该引用，再独占修改队列；调用者仍拥有更新后的队列。函数参数签名不可更改。

**分层提示：** ① 在 push 前借用并打印 `queue[0]`。② 确保该引用之后不再使用。③ 将 `next` 移入队列，然后返回长度。

## 4. 可复现实验：NLL 最后使用点与 E0502

画出首项借用的活跃区间，再对照正常 `m05::` 测试与 E0502 反例。分别尝试先读后写、保存索引后重新读取、拥有型克隆三种改法；解释哪种需要分配，以及何时索引也可能失效。

从仓库根目录运行 `node scripts/verify-lesson-drills.mjs`，统一核对正例与预期编译失败的诊断。

## 参考答案

1. 程序通过编译，依次输出 `head: one` 和 `length: 2`。`first` 虽仍在词法作用域中，但最后一次读取在 `push` 之前，借用已结束。
2. 将 `println!("head: {first}");` 移到 `queue.push(String::from("two"));` 之前，再输出长度。原顺序在 push 后仍使用 first，因此触发 E0502。
3. 函数体可以写为：

   ```rust
   let first = &queue[0];
   println!("head: {first}");
   queue.push(next);
   queue.len()
   ```

   首项读取完成后不再使用引用，随后才修改队列。调用方保留 `queue` 的所有权。
