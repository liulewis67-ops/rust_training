# M13-L02 短练习：task、线程与调度

三题围绕 task 的执行边界。回答必须写明 runtime flavor；不要根据 task 数量推断 OS thread 数量或任务执行顺序。

## 预测：current-thread 上的 task 与 thread

在 `#[tokio::test(flavor = "current_thread")]` 中，记录当前 OS thread id，然后 `tokio::spawn(async { std::thread::current().id() })` 并 await handle。预测返回的 id 是否相同；若把 runtime 改为 multi-thread，能否继续承诺相同？说明原因。

**公开契约**：区分 task 与 OS thread；答案只为 current-thread flavor 保证，不把 multi-thread 的实际调度顺序写成保证。

**分层提示**：① spawn 创建由 runtime 调度的 task。② current-thread 只有一条 runtime worker。③ 多线程下不要推断 task 固定在哪条 worker。

## 修复：找出 sibling 不推进的原因

下面代码在 current-thread runtime 中 spawn probe task 后执行同步等待。修改为非阻塞的异步等待；保持事件含义不变，并指出原代码会让哪个调度资源停滞。

```rust
async fn wait_for_readiness() {
    std::thread::sleep(std::time::Duration::from_millis(20));
}
```

**公开契约**：改为 Tokio 异步 timer Future 并 `.await`；解释执行到 timer 等待时当前 task 可交还控制权。此题不要求通过 sleep 推断任意 task 顺序。

**分层提示**：① 区分 `std::thread::sleep` 与 Tokio timer。② async 只描述 Future，阻塞调用本身仍会阻塞执行它的 thread。③ 使用 `tokio::time::sleep(...).await`。

## 实现：观测单线程调度边界

按样例实现一个 current-thread Tokio test：在记录 shared event 的 sibling task 已 spawn 后，主 task 通过标准库同步 channel 等待测试 watchdog 放行；确认等待返回之前 sibling 事件不存在，await task handle 后事件出现。所有同步等待设时限；不得用固定 sleep 或断言未受契约保证的默认 task 顺序。

**公开契约**：事件包含主 task 的 `blocking-start` 和 `blocking-end`，sibling 只能在主 task 释放唯一 runtime thread 后记录；故障路径有明确截止时间并 join watchdog。

**分层提示**：① 选择 `#[tokio::test(flavor = "current_thread")]`。② 用 rendezvous channel 建立 watchdog 与同步阻塞的先后。③ 只有 await sibling handle 才会让 executor 获得再次 poll 的机会。

参考答案和边界评分规则位于私有评测资料。
