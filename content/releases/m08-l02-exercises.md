# M08-L02 练习：闭包捕获与 Fn 系列

## 1. 预测：调用 trait 与 move

~~~rust
/// Calls a reusable callback twice.
fn twice<F: Fn() -> usize>(callback: F) -> (usize, usize) {
    (callback(), callback())
}

/// Predicts the capability of a move closure that only reads its capture.
fn main() {
    let name = String::from("cache");
    let size = move || name.len();
    assert_eq!(twice(size), (5, 5));
}
~~~

预测这个程序能否编译，并说明 size 是否因为 move 而只能实现 FnOnce。闭包调用后，main 能否继续读取原来的 name 绑定？

**提示**：先判断 move 对 String 做了什么，再看闭包体实际对被捕获字段做了什么。

**验证契约**：Rust 1.95.0、Edition 2024 编译运行通过；name 被移入闭包，main 不能再使用原绑定；闭包体只共享读取 String，因此满足 Fn 和两种更宽松的父 trait。

## 2. 修复：允许回调修改计数器

下面的函数要求回调实现 Fn，但调用方传入的闭包会修改 captured。修复 bound 与必要的可变绑定，使闭包能被调用两次并返回 1、2。

~~~rust
/// Calls a callback twice.
fn collect_pair<F>(callback: F) -> (u32, u32)
where
    F: Fn() -> u32,
{
    (callback(), callback())
}

/// Attempts to increment captured state twice.
fn main() {
    let mut value = 0;
    let increment = || {
        value += 1;
        value
    };
    assert_eq!(collect_pair(increment), (1, 2));
}
~~~

**提示**：回调需要通过哪种借用修改它的环境？函数参数和 closure binding 是否都允许这次可变访问？

可选择将闭包按值移动到函数里，或将它可变借用传入；后一种写法需要调用方把局部闭包变量声明为 mut。

**验证契约**：原方案在 collect_pair(increment) 处因闭包只实现 FnMut 而无法满足 Fn；正确方案要求 FnMut 并将函数参数声明为 mut。按值移动时调用方不需再修改局部绑定；经由 &mut 传入时调用方绑定也须为 mut。两种修复均返回 (1, 2)。

## 3. 实现：最多运行一次的延迟名称

实现 resolve_name：若已有名称就直接返回；若没有，则调用 fallback 生成名称。fallback 可消费其捕获的 String，因此函数只能对它提出“可调用一次”的最低要求。分别验证 Some 路径和 None 路径。

~~~rust
/// Returns an existing name or obtains one from a one-shot callback.
fn resolve_name<F>(name: Option<String>, fallback: F) -> String
where
    // TODO: select the least restrictive callable trait
    F: Fn() -> String,
{
    match name {
        Some(name) => name,
        None => fallback(),
    }
}

/// Tests supplied and lazily generated names.
fn main() {
    let supplied = resolve_name(Some(String::from("manual")), || String::from("unused"));
    assert_eq!(supplied, "manual");

    let owned = String::from("generated");
    let generated = resolve_name(None, move || owned);
    assert_eq!(generated, "generated");
}
~~~

**提示**：fallback 最多被调用几次？move || owned 的函数体把 String 从闭包中移出吗？

**验证契约**：参考实现使用 FnOnce() -> String；Some 路径保留给定名称，None 路径返回闭包消费的 String。要求 Fn 或 FnMut 的实现无法接受只实现 FnOnce 的 move 闭包。

## 4. 进阶实证：闭包捕获行为如何决定 Fn、FnMut、FnOnce

预测三种闭包分别最多能满足什么调用约束，运行正例并复现 E0525。将错误函数改为 `F: FnMut()` 并给形参加 `mut`，保持两次调用得到 1、2；再尝试把 `FnOnce` 消费闭包调用两次，说明与 `FnMut` 的差异。

**验收：** 提供 `cargo +1.95.0 test --offline --manifest-path content/samples/verified-lesson-drills/Cargo.toml m08_closures::` 的通过结果、错误示例或行为回归的证据，并解释最小修复不如何改变原有接口契约。

## 参考答案

1. `move || name.len()` 将 `name` 移入闭包，但只读取其长度；它仍可实现 `Fn`，因此也满足 `FnMut` / `FnOnce` 的要求。旧 `name` 绑定不可再用。
2. 改为 `FnMut` 并让参数绑定可变：

   ```rust
   fn collect_pair<F>(mut callback: F) -> (u32, u32)
   where
       F: FnMut() -> u32,
   {
       (callback(), callback())
   }
   ```

3. 一次性后备名称使用 `FnOnce`：

   ```rust
   fn resolve_name<F>(name: Option<String>, fallback: F) -> String
   where
       F: FnOnce() -> String,
   {
       match name {
           Some(existing) => existing,
           None => fallback(),
       }
   }
   ```

只在缺失分支调用 fallback，因此 `Some` 不会提前消费计算结果；`None` 可接受移动 `String` 的闭包。

## 来源

- [The Rust Programming Language](https://doc.rust-lang.org/book/)
