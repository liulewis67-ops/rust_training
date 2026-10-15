# M04-L02 三道短练习草案

状态：课前草稿；依赖 M04-L01，尚未经过 R1、平台或独立学习者验收。

## 1. 预测：赋值之后谁拥有字符串？

```rust
/// Transfers a String from one binding to another.
fn main() {
    let source = String::from("alpha");
    let destination = source;
    println!("{destination}");
}
```

预测输出，并说明若把 `println!` 中的名字改成 `source` 是否仍可编译。用一行图示表示赋值前后哪个绑定拥有值。

**契约：** 输出为 `alpha`；赋值后 `destination` 是 owner，使用 `source` 会触发 E0382。

**分层提示：** ① `String` 是否是 `Copy` 值？② 看赋值右侧和左侧名字。③ 画唯一 owner 指向同一个值。

## 2. 修复：按值参数后仍使用旧绑定

```rust
/// Prints a task label after taking ownership.
fn show_task(task: String) {
    println!("task: {task}");
}

/// Tries to reuse a moved value.
fn main() {
    let task = String::from("review");
    show_task(task);
    println!("still available: {task}");
}
```

当前代码应因移动后使用而不能编译。修改 `show_task` 和调用处，让函数先输出 `task: review`，并将所有权返回给调用方，使第二行输出 `still available: review`。本题不使用引用或 `.clone()`。

**契约：** 修复版编译且按顺序输出两行；解释参数传入和返回表达式分别如何转移 owner。

**分层提示：** ① 当前函数签名是否返回 owned value？② 哪个表达式能把参数交还给调用方？③ 调用方用返回值重新绑定后再打印。

## 3. 实现：沿参数与返回位置转交 owner

完成 `relay`，让收到的 `String` 由调用方重新取得。不得丢弃该值，也不使用克隆或引用。

```rust
/// Transfers ownership from its parameter back to its caller.
fn relay(value: String) -> String {
    // TODO: Return the owned value.
    todo!()
}

/// Moves a label through a function boundary and returns it.
fn prepare_label(label: String) -> String {
    let current_owner = label;
    relay(current_owner)
}

/// Uses the value after receiving ownership back.
fn main() {
    let input = String::from("ready");
    let output = prepare_label(input);
    println!("{output}");
}
```

**契约：** 正确实现输出 `ready`；标出 `input` 到 `label`、`label` 到 `current_owner`、`current_owner` 到 `relay` 参数，以及返回值到 `output` 的 owner 变化。禁止 `.clone()` 和硬编码输出。

**分层提示：** ① `relay` 签名承诺返回一个 `String`。② 函数参数名本身是当前 owner。③ 返回该绑定，让调用处接管它。
