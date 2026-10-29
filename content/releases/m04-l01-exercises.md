# M04-L01 练习：scope 与 `Drop`

## 1. 预测：内层值先销毁

```rust
/// Prints one cleanup event when the owner is dropped.
struct Marker {
    name: &'static str,
}

impl Drop for Marker {
    fn drop(&mut self) {
        println!("drop {}", self.name);
    }
}

/// Creates owners in two nested scopes.
fn main() {
    let outer = Marker { name: "outer" };
    {
        let first = Marker { name: "first" };
        let last = Marker { name: "last" };
        println!("finish inner");
    }
    println!("finish main");
}
```

写出完整输出，并画出 `outer`、`first`、`last` 的绑定—值—作用域关系。说明为什么 `last` 在 `first` 前销毁，而 `outer` 留到最后。

**契约：** 输出依次为 `finish inner`、`drop last`、`drop first`、`finish main`、`drop outer`；解释需同时覆盖内层作用域和反向创建顺序。

**分层提示：** ① 标出两个花括号边界。② 找出内层两个绑定的声明顺序。③ 在每个作用域退出位置写出反向顺序的 Drop 事件。

## 2. 修复：不要直接调用析构方法

```rust
/// Logs cleanup when its owner is dropped.
struct Guard {
    name: &'static str,
}

impl Drop for Guard {
    fn drop(&mut self) {
        println!("drop {}", self.name);
    }
}

/// Attempts to release a guard before its scope ends.
fn main() {
    let mut cache = Guard { name: "cache" };
    Drop::drop(&mut cache);
    println!("continue with scope");
}
```

当前程序不能编译。改写提前释放代码，使程序先输出 `drop cache`，再输出 `continue with scope`；不得再次销毁同一值，也不得删除 `Drop` 实现。

**契约：** 错误版因直接调用析构方法被拒绝；修复版使用标准库提供的提前销毁操作，编译成功并按给定顺序输出两行。

**分层提示：** ① 不能直接调用 trait 的 `drop` 方法。② 搜索标准库的消费型提前销毁函数。③ 将 `cache` 传入该函数后，不再使用它。

## 3. 实现：写一个可观测的作用域清理

为 `ReleaseNote` 实现 `Drop`，在 owner 被销毁时打印 `release <name>`。保留题目中的类型与字段，不在 `main` 中手动调用析构方法。

```rust
/// Owns a label for one short-lived resource.
struct ReleaseNote {
    name: String,
}

impl ReleaseNote {
    /// Creates a note with an owned name.
    fn new(name: &str) -> Self {
        Self {
            name: String::from(name),
        }
    }
}

impl Drop for ReleaseNote {
    fn drop(&mut self) {
        // TODO: Print the release event for this note.
    }
}

/// Shows the expected event order at a nested scope boundary.
fn main() {
    let outer = ReleaseNote::new("workspace");
    {
        let inner = ReleaseNote::new("temporary");
        println!("work complete");
    }
    println!("returning");
}
```

**契约：** 运行输出为 `work complete`、`release temporary`、`returning`、`release workspace`。由作用域自动触发清理；字段 `name` 保持由 `ReleaseNote` 拥有。

**分层提示：** ① `Drop::drop` 需要可变借用 `self`。② 读取 `self.name` 形成事件文字。③ 用一条 `println!` 记录释放，再由作用域决定何时执行。

## 4. 进阶实证：作用域退出、逆序析构与显式 drop

绘制外层 owner 与两个内层 owner 的创建/销毁顺序，运行两项正例并复现 E0040。让一个拥有型资源在内层作用域结束前通过 `std::mem::drop` 提前释放，验证日志不重复，并说明为什么直接调用 trait 方法非法。

**验收：** 提交 `cargo +1.95.0 test --offline --manifest-path content/samples/verified-lesson-drills/Cargo.toml m04_scope::` 的测试结果、故意失败反例的诊断和独立修复方案，并解释为什么不能靠克隆、删断言或延长标注伪造正确性。

## 参考答案

1. 输出依次为 `finish inner`、`drop last`、`drop first`、`finish main`、`drop outer`。`first` 和 `last` 属于内层作用域，离开该作用域时按创建顺序的反序销毁；`outer` 属于 `main` 作用域，留到 `main` 结束。
2. 用 `std::mem::drop(cache);` 替换直接调用 `Drop::drop` 的那一行。标准库的 `drop` 消费 `cache`，在该语句处销毁它；随后只打印 `continue with scope`，不会再次使用已移动的绑定。
3. 在 `Drop::drop` 中写 `println!("release {}", self.name);`。完整输出是 `work complete`、`release temporary`、`returning`、`release workspace`。清理由 owner 离开各自作用域触发。

## 来源

- [The Rust Programming Language：Running Code on Cleanup with the `Drop` Trait](https://doc.rust-lang.org/book/ch15-03-drop.html)
- [The Rust Reference：Destructors](https://doc.rust-lang.org/reference/destructors.html)
