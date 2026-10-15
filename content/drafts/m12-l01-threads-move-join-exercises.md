# M12-L01 短练习：线程、move 捕获与 join 结果

## 1. 预测：move 后哪些值还可用？

```rust
use std::thread;

let label = String::from("package");
let width = 8_usize;
let handle = thread::spawn(move || (label, width + 1));
let width_after_spawn = width;
let result = handle.join();
```

判断 `label` 和 `width` 在 spawn 后能否由外层继续使用，`width_after_spawn` 的值，以及 `join()` 的成功类型和值。再说明如果移除 move，哪条捕获会因生命周期而失败。答案须区分非 Copy 移动和 Copy 捕获。

**分层提示**

1. `move` 表示按值捕获，仍要看每个捕获值自己的 Copy 属性。
2. String 被移进闭包；usize 被复制，外层仍可读取。
3. worker 返回 `(String, usize)`，`join()` 返回 `thread::Result<(String, usize)>`。

## 2. 修复：保留调用方值并安全启动 worker

```rust
use std::thread;

fn measure(label: &str) -> thread::Result<usize> {
    let handle = thread::spawn(|| label.len());
    handle.join()
}
```

保持 `measure` 返回值契约，并且函数返回后调用方仍拥有原始 label。最小化修复闭包捕获；解释为何需要一个 owned worker capture，以及 clone 应发生在什么边界。不要添加 `'static` 标注或泄漏引用。

**分层提示**

1. 借用参数不能被普通 spawn 的 `'static` 闭包保留。
2. 若 worker 与调用方都需使用 String，显式 clone 一份局部 String。
3. move 这份副本进 closure；join 后返回长度，原始 `label` 仍由调用方拥有。

## 3. 实现：将返回值与 panic 结果分开收集

实现函数：

```rust
fn run_job(input: String, should_panic: bool) -> thread::Result<(String, usize)>;
```

成功路径把 input 的所有权交给 worker，由 worker 返回原字符串及其字节长度；panic 路径由 worker 执行 `panic!("simulated worker failure")`。补测试断言成功结果、panic 返回 Err、panic payload 类型可识别，并且不将 worker panic 误解为普通 join panic。不可用 `join().unwrap()` 让 panic 再传播到调用线程。

**分层提示**

1. move 闭包拥有 input 和复制进来的 bool。
2. 成功分支返回 `(input, input.len())`；两个线程之间移动的返回值也必须 Send。
3. 保留 join 的 `thread::Result`，在测试里对 Err payload 做类型检查。
