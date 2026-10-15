# M14-L02 短练习：mpsc 与 oneshot

## 1. 预测：不同 close 方向

给定 bounded mpsc channel 容量 1，`tx` 与 `tx2 = tx.clone()` 指向同一 receiver。先发送 `1`，drop `tx2`，receiver 取出 `1` 后调用 `recv`。说明该 Future 会 Pending 还是得到 `None`；随后 drop 最后一个 `tx`，再说明下一次 `recv` 的结果。最后说明 receiver 已 drop 时，`tx.send(2).await` 的错误中是否还能拿回 `2`。

**契约**：必须区分单个 clone 退出、最后一个 sender 退出、buffer drain、Pending 和 receiver 先退出五个事件。

**提示**：画出两端存活状态以及缓冲区内容，不要只看某个 handle 的 drop。

**验证**：在 Tokio test 中逐行执行 gate 操作并断言 `Some(1)`、之后的关闭结果与 SendError 内的值。

## 2. 修复：保留交付失败

修复下面的 publisher：receiver 已经可能离开，但函数不能把“消息成功发送”报告成成功，也不能丢掉失败类别。

```rust
async fn publish(tx: tokio::sync::mpsc::Sender<String>, message: String) -> bool {
    let _ = tx.send(message).await;
    true
}
```

**契约**：返回类型改为能表达 SendError 的 `Result`；成功和 receiver 关闭分别得到可区分结果。

**提示**：`Sender::send` 的错误类型包含原 message。题目不要求实现 retry。

**验证**：receiver 存活与先 drop 两种分支都要断言；后者不能返回 `Ok(())`。

## 3. 实现：汇总一次性交付

完成配套 sample crate 的 `classify_reply`，将 `oneshot::Receiver<T>` 的结果映射为 `Reply::Value(T)` 或 `Reply::SenderGone`。测试需验证成功 send、发送方未发送就 drop，以及 receiver 已 drop 时 `Sender::send` 返回原值。

**契约**：不创建默认成功值，不把 `RecvError` 当成 task panic，也不改变公开 enum/函数签名。

**提示**：oneshot `Sender::send` 同步且消费 sender；接收端 await 的失败类型与 sender.send 失败不是同一个方向。

**验证**：运行 `cargo fmt -- --check`、`cargo test --locked --offline`、严格 Clippy 与 Rustdoc。

## 答案与尝试

首次独立作答前不要打开私有评分文件。使用提示或答案仍可继续练习，但这次不能记为未看答案的独立证据。正式平台成绩只接受绑定任务快照的受控评测。
