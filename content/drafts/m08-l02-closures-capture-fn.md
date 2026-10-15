# M08-L02：闭包捕获与 Fn 系列

## 学完后

- 说明闭包怎样从定义处的环境中捕获数据，以及 move 改变什么。
- 根据闭包体对捕获值的使用判断它实现 Fn、FnMut、FnOnce 中的哪些调用 trait。
- 为回调函数选择足够宽松、又符合调用次数和修改需求的 trait bound。
- 修复因为要求 Fn 却传入会修改捕获状态的闭包而产生的类型错误。

## 先修

实施制作顺序依赖 M08-L01；概念上需要理解引用、可变借用、所有权转移和泛型 trait bound。本稿仍为私有预写内容，M07-L06/M08-L01 正式验收、I06-F04 与 R2 尚未完成。

## 闭包是能携带环境的匿名值

函数不能直接读取其定义位置周围的局部变量；闭包可以捕获环境中的值。编译器为每个闭包表达式创建独有类型，概念上类似一个保存捕获字段的匿名结构体。下面的 formatter 只共享借用 site，每次调用都可以重复读取：

~~~rust
/// Calls a read-only label formatter twice.
fn preview_twice<F>(format_label: F) -> (String, String)
where
    F: Fn(&str) -> String,
{
    (format_label("prepare"), format_label("publish"))
}

/// Formats two labels by immutably capturing the site name.
fn main() {
    let site = String::from("north");
    let formatter = |action: &str| format!("{site}:{action}");
    assert_eq!(
        preview_twice(formatter),
        (String::from("north:prepare"), String::from("north:publish"))
    );
    assert_eq!(site, "north");
}
~~~

闭包没有改变 site，也没有把它移出闭包，所以闭包可通过共享借用反复调用，满足 Fn。闭包类型都是 FnOnce；其中不修改、也不移出捕获值的闭包还满足更具体的 Fn，而 Fn 实现了 FnMut，FnMut 又实现 FnOnce。可把三者看作调用者允许闭包做的事：Fn 以共享借用调用；FnMut 以可变借用调用；FnOnce 消费闭包并按值调用一次。

## 修改捕获状态需要 FnMut

闭包体若修改捕获变量，需要通过可变借用调用。调用该闭包的函数因此要求 FnMut；持有闭包的局部绑定也通常需要声明为 mut：

~~~rust
/// Calls a stateful callback twice and returns both results.
fn call_twice<F>(mut callback: F) -> (usize, usize)
where
    F: FnMut() -> usize,
{
    (callback(), callback())
}

/// Increments captured state through a mutable closure borrow.
fn main() {
    let mut attempts = 0;
    let mut next_attempt = || {
        attempts += 1;
        attempts
    };

    assert_eq!(call_twice(&mut next_attempt), (1, 2));
    assert_eq!(attempts, 2);
}
~~~

这里 callback 按 &mut F 调用，因此 call_twice 的参数绑定必须可变。实际闭包对 attempts 的修改也要求该环境位置可变借用。FnMut 不代表闭包只能调用一次；它可以被重复调用，只是各次调用允许修改闭包状态。

## 消费捕获值需要 FnOnce

若闭包体把一个非 Copy 捕获值移出，之后就无法再用同一个闭包完成相同动作。用 FnOnce 表达“本操作至多调用一次”：

~~~rust
/// Runs one operation that may consume its captured state.
fn run_once<F, T>(operation: F) -> T
where
    F: FnOnce() -> T,
{
    operation()
}

/// Moves an owned message out of a closure exactly once.
fn main() {
    let message = String::from("release accepted");
    let take_message = move || message;
    let result = run_once(take_message);
    assert_eq!(result, "release accepted");
}
~~~

调用后，消息的所有权成为返回值的一部分；闭包也已被消费。若把 bound 改成 Fn 或 FnMut，就会要求能够借用调用且不消费闭包，这与移出 message 冲突。反过来，如果函数最多只需要调用一次，应优先接受 FnOnce：它也能接受实现了 Fn 或 FnMut 的闭包，调用方限制最少。

## move 指定捕获所有权，不单独决定调用 trait

move 让闭包把使用到的外部变量按值捕获：对于 String 这样的非 Copy 值，这会把所有权移入闭包；对于 Copy 值，则复制进闭包。move 关键字本身并不等于 FnOnce。闭包体如何使用捕获字段才决定调用 trait：

~~~rust
/// Reuses a move closure whose body only reads its owned capture.
fn call_twice<F>(callback: F) -> (usize, usize)
where
    F: Fn() -> usize,
{
    (callback(), callback())
}

/// Owns a label in a move closure while calling it repeatedly.
fn main() {
    let label = String::from("artifact");
    let length = move || label.len();
    assert_eq!(call_twice(length), (8, 8));
}
~~~

label 所有权移入了闭包，但闭包体只共享读取它，没有移出或修改它，因此仍满足 Fn。不要只看到 move 就判定只能调用一次。也不要将调用 trait 与闭包是否捕获环境混为一谈：不捕获环境的闭包通常也实现 Fn 系列，并可在签名匹配时转为函数指针；本节练习重点是捕获场景。

## 按所需行为选择 trait bound

- 回调可重复调用且只读取捕获数据：接受 Fn。
- 回调可重复调用并修改捕获状态：接受 FnMut，并通过可变访问调用。
- 回调最多运行一次，可能消费自身或捕获值：接受 FnOnce。
- Fn 是 FnMut 的子 trait，FnMut 是 FnOnce 的子 trait。需求只要求调用一次时，用 FnOnce 能接纳最多种闭包。

这是 API 对调用者给出的能力约束，不是要求调用者手工实现这些 trait；普通闭包会由编译器根据捕获及闭包体行为自动满足相应 trait。若 closure capture 导致借用冲突，先明确数据应该由闭包借用、修改还是拥有，不要先对所有东西加 move 或 clone 来压过诊断。

## 分层提示

1. **捕获提示**：闭包体用到哪些外部变量？读、修改，还是把值移出？
2. **bound 提示**：函数会调用回调几次？是否需要获得它的可变访问？
3. **move 提示**：move 影响捕获方式；再单独看闭包体动作，判断 Fn 家族。
4. **参考方案**：按 FnOnce → FnMut → Fn 的能力限制顺序检查，选择允许该函数体行为的最窄需求。

## 来源

- [The Rust Programming Language：Closures](https://doc.rust-lang.org/book/ch13-01-closures.html)
- [Rust Reference：Closure types](https://doc.rust-lang.org/reference/types/closure.html)
- [标准库：Fn](https://doc.rust-lang.org/std/ops/trait.Fn.html)、[FnMut](https://doc.rust-lang.org/std/ops/trait.FnMut.html)、[FnOnce](https://doc.rust-lang.org/std/ops/trait.FnOnce.html)

课程解释与场景为原创；官方来源用于核对捕获方式和闭包调用 trait 的规则。
