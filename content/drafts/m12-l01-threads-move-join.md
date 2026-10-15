# M12-L01：线程、`move` 闭包与线程结果

## 学完后

- 用 `std::thread::spawn` 启动独立线程并保留 `JoinHandle<T>`。
- 通过 `join()` 等待线程结束，并区分线程返回值与线程 panic 的结果。
- 用 `move` 让闭包取得线程需要的所有权；分清 Copy 捕获与非 Copy 值移动。
- 解释普通 `spawn` 对闭包和返回值要求 `Send + 'static` 的原因。
- 不依赖线程调度顺序、打印顺序或 sleep 时长判断正确性。

## 先修

完成 M11-L06，能够按所有权和共享边界选择借用、拥有、Rc/Arc；熟悉闭包的 `FnOnce` 与 move 语义。这里使用标准库线程，不引入 async runtime、锁、channel 或第三方 crate。

## 启动线程与等待结果

`thread::spawn` 将 `FnOnce` 闭包交给新线程，返回 `JoinHandle<T>`。闭包的返回值就是 handle 的 `T`。保存 handle 并调用 `join()`，主线程会阻塞等待目标线程结束；`join()` 返回 `thread::Result<T>`，即 `Result<T, Box<dyn Any + Send + 'static>>`：

```rust
use std::thread;

let handle = thread::spawn(|| {
    let values = [4_u32, 8, 15];
    values.into_iter().sum::<u32>()
});

let result = handle.join();
assert_eq!(result.expect("worker should finish"), 27);
```

如果丢弃 `JoinHandle`，线程会 detach，调用方就不能再 join 它。程序主线程结束时，尚未结束的 spawned threads 会被关闭；不能假定调度器一定给某个线程足够时间。要收集结果和确保结束，就显式保留并 join handle。多个线程运行先后不确定，所以测试应断言结果和同步契约，而不应断言谁先打印。

## 把线程 panic 当作 join 结果处理

`join()` 本身并不会自动把 worker panic 重新抛到 join 的线程；它将 panic payload 放在 `Err` 中。调用方可在预期的故障边界检查这个结果：

```rust
use std::thread;

let handle = thread::spawn(|| -> usize {
    panic!("worker input was invalid");
});

let outcome = handle.join();
assert!(outcome.is_err());
```

不要用 `join().unwrap()` 处理本来需要隔离或汇报的 worker 故障；这会在调用线程再次 panic。库可将 `thread::Result<T>` 继续交给调用方，应用边界则可检查 payload 并转为自己的错误或失败记录。OS 无法创建线程是另一个失败点：`thread::spawn` 在该情况下 panic；若需要可恢复的创建错误，使用 `thread::Builder::spawn` 获得 `io::Result<JoinHandle<T>>`，再单独处理 join 结果。

## `move` 表示闭包拿到捕获值

没有 `move` 时，闭包通常按使用方式借用外部变量。普通 `spawn` 的线程可能比调用处活得更久，因此不允许闭包借用短生命周期的局部变量：

```rust,compile_fail
use std::thread;

let label = String::from("compile");
let handle = thread::spawn(|| label.len());
handle.join().unwrap();
```

使用 `move` 把所需值带入闭包：

```rust
use std::thread;

let label = String::from("compile");
let handle = thread::spawn(move || (label, 7_usize));
let (returned_label, length) = handle.join().expect("worker should finish");
assert_eq!(returned_label, "compile");
assert_eq!(length, 7);
```

`move` 影响捕获方式，不是“所有值都一定被消耗”的同义词。非 Copy 的 String 会移动进闭包；Copy 的 `usize`/bool 等值会按值复制进闭包，因此原变量仍可继续使用。如果调用方和 worker 都要拥有同一个 String 值，就在边界前明确 clone 一份，然后 move 那份副本：

```rust
let label = String::from("compile");
let worker_label = label.clone();
let handle = thread::spawn(move || worker_label.len());

assert_eq!(label, "compile");
assert_eq!(handle.join().expect("worker should finish"), 7);
```

只为避免编译器报错而对任意大对象 clone，不是默认解法；先判断调用方是否还需要它、是否应将所有权直接转移、或后续是否真的需要共享。

## `Send + 'static` 的边界

`spawn` 要求闭包和返回值满足线程转移所需的 `Send + 'static`。闭包会被按值送到另一个线程，返回值会从 worker 送回 join 调用方，因此两端都必须允许跨线程移动。`'static` 不是说对象必须活到程序退出，而是不能借用比线程短命的非 `'static` 数据；拥有 String、Vec 等数据可以满足 `'static`。Send/Sync 类型规则会在下一节展开。

普通 `spawn` 不能捕获局部引用。确实需要线程借用栈上数据时，可以评估 `thread::scope`：scope 保证所有子线程在 scope 结束前 join，借用不能逃出 scope；本节暂不将它当作默认替代方案。

## 分层提示

1. **生命周期提示**：spawn 后闭包可能活到调用作用域结束以后；它捕获的是拥有值还是局部引用？
2. **捕获提示**：给闭包加 `move` 后，分别检查 String 和整数。哪个值会移动，哪个 Copy 值仍能留在外层？
3. **共享提示**：只有调用方与 worker 确实需要各自拥有同一 String 时才 clone；若调用方不再需要，直接 move。
4. **结果提示**：JoinHandle 只能 join 一次；先处理 `Result`，再使用返回值。panic payload 不等于普通业务错误。
5. **测试提示**：对 `join()` 的值和 Err 做断言，不以 sleep 或打印顺序制造同步。

## 来源

- [The Rust Programming Language：使用线程并行运行代码](https://doc.rust-lang.org/book/ch16-01-threads.html)
- [Rust 标准库：`thread::spawn`](https://doc.rust-lang.org/std/thread/fn.spawn.html)
- [Rust 标准库：`JoinHandle<T>` 与 `join`](https://doc.rust-lang.org/std/thread/struct.JoinHandle.html)
- [Rust 标准库：`thread::Result`](https://doc.rust-lang.org/std/thread/type.Result.html)
- [The Rust Programming Language：闭包捕获](https://doc.rust-lang.org/book/ch13-01-closures.html)

官方资料用于核对线程生命周期、Send 约束、handle detach/join 和 panic payload；示例情境与练习为原创。
