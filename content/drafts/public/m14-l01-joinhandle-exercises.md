# M14-L01 短练习：JoinHandle 与任务结果

## 1. 预测：区分任务与业务结果

读下面代码，不运行它，写出 `outer` 和 `inner` 分别是什么，并说明 task 是否因业务返回 Err 而 panic：

```rust
let handle = tokio::spawn(async { Err::<u32, &'static str>("bad input") });
let outer = handle.await;
```

**契约**：必须写清两层类型与具体值；只写“返回错误”不够。

**提示**：先写 `JoinHandle<T>::Output`，再代入 task 的 `T`。

**验证**：用 `Result<Result<u32, &str>, JoinError>` 注解编译，并分别断言外层和内层。

## 2. 修复：不要丢掉需要的输出

修复以下函数，让它返回 spawned task 的 `u32` 结果。任务会正常返回 `42`；本题不要求设计 panic 策略。

```rust
async fn calculate() -> u32 {
    let _handle = tokio::spawn(async { 42_u32 });
    0
}
```

**契约**：函数 await 任务并返回 `42`，不得用固定值替代 task 结果，也不得把 handle 先 drop。

**提示**：保存 handle，并检查 await 的外层结果。

**验证**：current-thread Tokio test 调用 `calculate().await` 并断言等于 `42`；另说明 panic 会落在哪层。

## 3. 实现：分类 task 失败

在配套 sample crate 中完成 `classify_join`，把 JoinHandle await 结果映射为：正常值 `Completed(value)`、task panic `Panicked`、task abort `Cancelled`。不得把 panic 当作业务错误，也不得把取消报告为成功。

**契约**：三个分支都有行为断言；取消样例必须先让 task 等待 gate，再 abort/await，以排除它先正常完成的竞争。

**提示**：查看 `JoinError::is_panic` 和 `is_cancelled`。sample crate 的类型定义与测试入口不能改名。

**验证**：运行 `cargo fmt -- --check`、`cargo test --locked --offline`、严格 Clippy 与 Rustdoc。

## 答案与尝试

独立检查前不要打开 `content/drafts/private-assessment/m14-l01-evaluation.md` 或私有答案包。提示和答案可用于继续学习，但查看后该次不计为未看答案的独立证据。作者本机结果不能代替课程平台成绩。
