# M06-L01 练习：引用有效性与生命周期关系

## 1. 预测：作用域内的引用

```rust
fn main() {
    let owner = String::from("cache");
    let view = &owner;
    println!("{view}");
    println!("{}", owner.len());
}
```

预测程序能否编译及两行输出。说明 `view` 与 `owner` 各自表示什么，并指出每次借用读取发生时 owner 是否仍有效。

**提示**：引用不会 move `owner`；检查最后一次引用读取和 owner 的作用域结束位置。

**验证契约**：Edition 2024 编译运行；输出为 `cache` 与 `5`。解释需指出引用指向 `owner` 持有的 String，owner 在两次访问时仍有效。

## 2. 修复：不要返回已销毁值的引用

```rust
fn make_path() -> &String {
    let path = String::from("/var/cache/app");
    &path
}
```

改写函数和一个调用点，让调用方可以安全打印路径。保留完整文本并解释原实现中哪个值先失效。

**提示**：路径在函数内新建；调用方需要拿到可继续使用的文本。参考“返回 owner”的设计。

**验证契约**：正确实现使用 `fn make_path() -> String` 返回 owner，调用方绑定后打印；编译运行输出 `/var/cache/app`。原实现必须在编译阶段被拒绝，诊断文字随工具链版本可异。

## 3. 实现：返回引用还是 owner？

实现 `first_segment`，返回输入路径第一个 `/` 前的文本；没有 `/` 时返回整个输入。用 `&str` 输入和 `&str` 输出，不分配新字符串；添加三个测试：一般路径、空输入、无分隔符。

```rust
fn first_segment(path: &str) -> &str {
    // TODO: Return a slice that remains tied to the input owner.
    todo!()
}
```

**提示**：`split('/')` 的第一个元素已满足边界条件。返回值指向输入而不是函数局部新建的 String。

**验证契约**：

- `first_segment("config/cache") == "config"`
- `first_segment("") == ""`
- `first_segment("standalone") == "standalone"`
- 正常和边界测试均通过；实现返回原始输入子切片，不调用 `to_owned`、`to_string` 或新建 `String`。

解释这三个函数设计：预测题在作用域内借用，修复题将新建数据的 owner 返回，实现题则借用调用方已有的输入。引用有效性取决于 referent（被引用值）的有效期，不取决于给引用添加一个更长的名字。

## 参考答案

1. 程序通过编译，输出 `cache` 和 `5`。`view` 借用 `owner`；两次读取都发生在 `owner` 离开 `main` 作用域之前。
2. 将函数改成 `fn make_path() -> String { String::from("/var/cache/app") }`，调用方用 `let path = make_path(); println!("{path}");`。原函数返回时局部 `path` 已销毁，不能把它的引用交给调用方。
3. 一种实现为 `path.split('/').next().unwrap_or("")`。迭代器的首项是输入切片；空输入得到空切片，无分隔符时得到整个输入，不创建新 `String`。