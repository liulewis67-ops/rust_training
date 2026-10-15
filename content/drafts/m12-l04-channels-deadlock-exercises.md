# M12-L04 短练习：消息通道、锁顺序和背压

## 1. 修复：传播 channel 关闭，不丢失发送值

```rust
use std::sync::mpsc::channel;

fn transfer() -> String {
    let (sender, receiver) = channel();
    drop(receiver);
    let value = String::from("payload");
    sender.send(value).unwrap();
    String::from("done")
}
```

改成返回 `Result<String, String>`：接收端关闭时不得 panic，要将未送达消息纳入错误信息；成功路径保留 `"done"`。再说明 receiver 还活着、成功发送时 String 的所有权流向。

**分层提示**

1. `send` 返回 `Result<(), SendError<T>>`；Err 里的 T 仍可取得。
2. 先匹配 send 结果，成功才继续，失败时将退回的 payload 转成可读错误。
3. 不要在错误分支 unwrap；用测试分别覆盖 Receiver 仍活着和提前关闭。

## 2. 实现：固定锁顺序下的双计数器更新

实现 `add_pair_in_order(left, right, amount)`，每次将 amount 加到两个 Mutex 保护的计数器。所有调用必须先取得 left，再取得 right。用 Barrier 同时启动多个 worker 调用它们，join 所有 worker，并断言两个计数器相等于 worker 数与 amount 的乘积。

**分层提示**

1. 明确双锁顺序属于 API 契约；不要由每个调用者自己排列锁。
2. 用 Arc 共享两个 Mutex 和 Barrier，每个线程获得自己的 handle 后等待同一屏障。
3. join 所有 worker 后分别读取两个值；不检查输出顺序，也不用 sleep。

## 3. 设计评审：有界队列中的背压和关闭

有一个容量为 2 的 `sync_channel`，producer 生成可变速率的记录，consumer 可能提前失败。评审下面两种方案：

- A：producer 对每条记录 `send`，忽略结果；consumer 失败后不再接收。
- B：producer 检查 `send` 返回值；consumer 在正常完成时持续排空直到 sender 关闭，在失败时先记录错误并关闭 receiver。

说明哪种方案能处理队列满、consumer 提前退出和正常关闭，指出 sender/receiver 应由谁 drop，并讨论为何不能在持有业务 Mutex 时等待满队列 send。为满队列压力写一个无需 sleep 的可复现检查。

**分层提示**

1. 容量满时 send 会等待；try_send 则以 Full 返回。
2. 接收端 drop 后发送失败，错误携带未发送值；忽略 Result 会丢掉失败信息。
3. 使用 capacity 1：先 try_send 填满，再 try_send 断言 Full；recv 一条后重试退回值。
