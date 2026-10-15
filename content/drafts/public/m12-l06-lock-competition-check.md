# M12-L06 独立检查：修复锁竞争并给出复现证据

## 检查目标

你接手一个共享配额表 `Mutex<HashMap<String, u64>>`。并行请求根据表中的 base limit 计算返回值。现在函数会在持锁时运行调用方提供的 `transform`，导致任意耗时计算期间其他请求和配置更新都被挡住。

检查任务：

1. 阅读陌生场景与起始 crate，不打开教师答案。
2. 修复 `quote_with`，只在锁内复制本次计算所需的 u64 snapshot，释放 guard 后再调用 transform。
3. 保持 missing-key 错误、变换结果和并行调用语义不变；不要克隆整个 HashMap 或把锁换成 async primitive。
4. 运行同一份确定性负载，在修复前与修复后记录：输出值、回调期间 try_lock 能否成功、竞争更新是否完成。结果必须相同，锁可用性应从 blocked 改为 available。
5. 从 starter ZIP 重新解压到新目录，核对 manifest，并复现起始失败；保留修复快照、版本和命令输出。

## 固定负载与可复现方法

测试表初值 `gold -> 10`。单 worker 调用 `quote_with("gold", |snapshot| snapshot * 3)`，transform 通过两个 Barrier 暂停在执行中。主线程收到“已进入 transform”的同步信号后立即 `try_lock`：

- 起始实现持有 guard 执行 transform，try_lock 稳定得到 WouldBlock，更新无法执行；
- 修复实现先复制 `10` 并释放 guard，try_lock 成功，将共享值更新为 `11`；
- 两种实现的在途 quote 都返回 `30`，因为它们基于调用开始时取得的 snapshot。

Barrier 只控制程序到达的阶段，不使用 sleep、墙钟阈值或概率性调度假设。测试会释放所有屏障并 join worker，即使起始实现失败也不会挂住。

## 技术约束

- `Mutex<T>` 保护跨线程共享状态；在 `&Registry` 方法中可通过 mutex 内部可变性更新表。
- 锁只保护查询/复制，不能覆盖 transform、I/O、等待或用户提供的回调。
- 锁粒度修复不能改变 API 外部结果；并发更新对后续调用生效，在途调用继续使用已读取的 snapshot。
- 是否使用 RwLock 要由真实读写频率和测量决定；这题只要求缩短临界区，不要求增加并发原语。

## 提交内容

- 修复后的源代码和回归测试；
- 修复前后同一负载的结构化证据（返回值、try_lock 结果、更新后状态、源码/测试版本哈希）；
- fmt/check/test/严格 Clippy/doc 命令记录；
- 起始 ZIP 的 SHA-256、manifest 复核和清洁重置记录；
- 独立提交快照标识。平台故障与代码失败分开记录。

此目录中的 starter、作者本机结果和私有参考仅供课程草案验收。正式独立性、快照绑定、评分反馈和技能证据须由 R2 课程平台完成。
