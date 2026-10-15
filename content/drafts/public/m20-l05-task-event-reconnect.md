# M20-L05：实验——任务状态订阅与重连

## 实验目标

用一个有序任务事件日志驱动状态订阅：每个任务的事件 ID 单调递增；断线后从 `Last-Event-ID` 后继续；重放同一事件不会重复产生业务效果；游标超过保留窗口时返回当前快照并提示较早事件已过期。

## 先修与本地边界

本实验依赖 M20-L04 的持久任务状态/恢复概念，并复用 M20-L03 的 SSE 连接生命周期。公开 starter 是单进程确定性模型，只验证游标、重放、去重和快照合同。正式接口参考 I10-F02 的 Axum/SQLx/PostgreSQL 合同：事件序号与业务变化同事务写入、每次续传重做身份/权限检查、数据库故障关闭流。没有运行数据库或 Linux 环境，不把内存实验报告成持久化验收。

## Event ID 与重连

一个 task/run 的 event sequence 从 1 开始严格递增。SSE `id` 使用该订阅范围内的规范十进制 sequence；客户端把最后处理成功的位置作为 `Last-Event-ID`。缺省按 0，拒绝负数、空白、符号、前导零（除字符串 `0`）和超出 `u64` 的值。每次重连用新的 HTTP request，并按同一 task scope 查询 `sequence > cursor`，升序返回有限批次，再继续读取更新。

重放是至少一次投递；网络成功写出并不表示客户端业务效果只执行一次。消费者以事件 ID 去重，并将“已应用的 event cursor”与对应业务状态原子保存。若事件 8 的副作用已完成、cursor 仍是 7，重连会再次收到 8；同事务去重或幂等副作用才能避免重复变更。若跳过事件，消费者应检测 sequence gap 并重取快照/日志，而不是无声推进 cursor。

## 保留窗口与快照恢复

当 `cursor < earliest_retained_sequence - 1` 时，服务端不能声称已经补齐缺失历史。按合同返回最新 task snapshot、最新可用 cursor 和 `early_events_expired=true`，客户端从快照建立新状态再接着订阅。游标只用于续传，不是用户 ID 或权限；每次订阅/批次仍要验证当前用户对 task/project 的访问权。超量回放使用有界批次，避免 reconnect 把过大历史一次塞入内存。

## 实验步骤、失败与重置

1. 将 `m20-l05-task-event-reconnect-starter.zip` 解压到空目录，核对 `starter-manifest.json` 后运行 `cargo test --locked`。
2. baseline 应暴露忽略 cursor、重复 apply 重复变更和 retention 过期未返回 snapshot 的失败。
3. 实现规范 cursor parser、`sequence > cursor` 重放、重复事件 no-op、gap 检测、过期快照回退；保持 per-task 顺序和错误可见。
4. 从原始 ZIP 再解压到新目录，确认相同 baseline，核对每个公开文件 hash；再修复并运行相同合同。

真实 PostgreSQL 事件表的并发序号分配、事务、用户隔离、权限撤销、连接断开、事件轮询容量与 outbox 恢复仍需 R3/I10-F02 验收。作者侧本机通过只证明此模型的可重复行为。

## 来源

- [WHATWG HTML Living Standard：Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html)：EventSource reconnect 与 `Last-Event-ID` 传递语义。
- [I10-F02 task store 合同](./i10-f02-idempotent-events-contract.md)：持久 per-task sequence、游标回放、访问复核和至少一次事件交付。

本实验的范围、游标格式、过期策略与断言是作者侧教学合同；不宣称 Web 标准规定数据库如何保存业务状态。
