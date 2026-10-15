# M13-L04 短练习：阻塞边界与并发上限

## 修复：limit 不能在工作开始后才申请

修复以下结构，使同一 `Arc<Semaphore>` 限制进入 blocking pool 的工作数。必须在调用 `spawn_blocking` 之前 acquire permit，并让 permit 在同步操作结束前一直有效。保留从 handle 收集返回值的行为。

```rust
let capacity = Arc::new(Semaphore::new(2));
let task = tokio::task::spawn_blocking(move || {
    // TODO: 现在才申请许可，pool 已经接受了工作。
    parse_with_sync_library(input)
});
let output = task.await?;
```

**公开契约**：阻塞操作同时执行数不超过共享 semaphore 容量；permit 生命周期跟随 closure 到结束；异步方可取得输出。

**分层提示**：① 先 acquire_owned。② 把 permit 与 input move 到 closure。③ 在 closure 内将 permit 绑定到局部变量，使其在返回后才 drop。

## 实现：给固定负载设置 blocking 上限

提交 4 个会在测试控制通道处暂停的 blocking 工作项，上限为 2。记录 active 与 peak；每当控制器观察到一批 2 个 started 事件，就 release 这批工作，然后等待下一批。检查所有输出、peak 不大于 2、最终 active 为 0。release 接收必须有 deadline。

**公开契约**：通过共享 Semaphore 在 spawn 前限额；每个 permit 必须随 closure 生命周期；无丢失工作项；不用 sleep/耗时阈值或依赖 task 默认调度顺序。

**分层提示**：① 用 `acquire_owned().await` 控制提交入口。② closure 开始时原子增加 active 并发送工作 ID。③ 控制器收到恰好一批 ID 后逐个发 release，再检查 active/peak。

## 设计评审：任务被 drop 后额度是否仍占用

评审一个实现：async wrapper 在 await `spawn_blocking` handle 前取得 semaphore permit，却把 permit 留在 wrapper 的栈上。调用者取消 wrapper 后，started blocking closure 仍运行。说明这个实现怎样突破业务上限，并提出最小修复；同时说明 abort handle 能否停止已开始的同步 closure。

**公开契约**：指出 permit 过早释放造成的因果路径；把 permit 移交 blocking closure；正确描述 spawn_blocking started 后的 abort 边界和最终清理责任。

**分层提示**：① drop wrapper 会 drop 它拥有的局部变量。② 这不等于已开始的 blocking closure 结束。③ semaphore permit 应属于实际执行 closure。

参考实现、评分规则和不安全变体验证保存在私有评测资料。
