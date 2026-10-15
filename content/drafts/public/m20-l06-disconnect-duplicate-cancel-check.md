# M20-L06：独立检查——断线、重复事件与取消竞争

## 作答规则

本节是 M20 独立检查，不是第 13 道短题，也不是 M20-L05 实验的复测。首次尝试只看本题、公开起始 ZIP 和公开合同；不要查看 M20-L04/L05 私有参考、本题隐藏用例或教师答案。可提交代码与新写的回归测试。看过参考答案后仍可练习，但该次及后续尝试不作为独立技能证据。

## 新情境与任务

新的 thumbnail-render task 在 worker 完成和用户 cancel 同时到达时，只允许一个终态提交。事件可能重放，客户端会带 `Last-Event-ID` 重连。请先写能在 starter 上失败的回归测试，再修复：

- 每 task 的事件序号稳定递增，重连返回 `sequence > cursor` 的事件；重复事件不得二次改变 projection。
- Cancel 与 worker completion 由先成功提交的条件迁移决定胜者；终态不可被后到请求覆盖。
- 取消会 fence 正在运行的 worker；携带旧 generation 的完成回传不提交成功状态或重复副作用。
- 丢失中间事件时报告 gap 并要求重取快照/事件，不悄悄跳过。
- 保留合法完成路径；不能通过拒绝所有事件让负面用例变绿。

## 时间线合同

同一个初始状态分别运行两种顺序：

1. `cancel(generation=4)` 先持久成功，随后 `finish(generation=4)` 到达：状态保持 Cancelled、generation 已 fencing，完成副作用数为 0。
2. `finish(generation=4)` 先持久成功，随后 cancel：状态保持 Succeeded，成功副作用只有 1 次。

两个独立事件投递同一 sequence 两次时，第二次不增加业务投影次数。若客户端 cursor 为 8，则 replay 不可再包含 8。任一合法新转换写出的事件 ID 都必须严格大于本 task 的前一事件 ID。

## 起始快照、提交追溯与重置

从 `m20-l06-check-starter.zip` 解压到空目录，先核对 `starter-manifest.json` 和版本，再运行公开检查。起始错误至少包含一项重复业务效果与一项终态竞争/过期 worker 问题。修复期间保留快照与原始合同；再次尝试必须重新解压 ZIP，不能把已修改工作区覆盖回 starter。

受控评测应记录 starter manifest、提交源 hash、测试 hash、course/assessment/evaluator 版本、首次尝试、是否看过答案、平台状态、outcome 和反馈分类。只有首次、答案未查看、平台 ready 且所有公开/隐藏 critical gate 通过时，才记录 `reliability.task-event-recovery` 的达成证据。本仓库作者侧试跑、fixture 和 schema 样例都不是学习者成绩。

## 评分与关键门

总分 100：取消/完成条件迁移与 stale fencing 35 分；稳定 ID、重连与重复事件去重 30 分；公开回归测试质量 20 分；版本/快照/说明 15 分。达到 85 分并通过所有 critical gate 才判通过。旧 generation 在取消之后仍能完成、重复 delivery 产生第二次副作用、cursor 重放等于 cursor 的事件、合法成功路径被全禁，任一项均阻断通过。

## 失败反馈分类

| 分类码 | 观察 | 下一步 |
|---|---|---|
| `DUPLICATE_EFFECT` | 相同 event ID 多次推进 projection/副作用 | 先做持久去重，再原子提交游标和状态 |
| `CURSOR_REPLAY` | response 含 `sequence <= Last-Event-ID` | 检查重放谓词和 task scope |
| `CANCEL_STALE_COMMIT` | cancel 已提交后旧 worker 仍写成功 | 条件更新同时比较 Running 状态与 generation |
| `TERMINAL_OVERWRITE` | Succeeded 被迟到 cancel 改写或反之 | 用单一终态条件迁移并明确先提交者胜 |
| `EVENT_GAP_IGNORED` | 丢失序号仍推进 projection | 请求快照/重新补齐事件，不跳过游标 |
| `POSITIVE_PATH_REGRESSED` | 通过一律拒绝破坏正常完成 | 保留成功及取消两条互斥正向路径测试 |
| `SNAPSHOT_INVALID` | starter/hashes/contracts 不匹配 | 从原始版本 ZIP 重置并保存证据 |
| `PLATFORM_UNAVAILABLE` | runner/数据库/评测服务故障 | 标 platform_error 并允许重试，不记学习者失败 |

反馈仅展示分类码、测试阶段和脱敏的期望/实际摘要，不展示隐藏 task ID 或答案片段。学习者失败可继续练习，不自动降低已记录的技能；平台错误不评分。

## 正式边界

本地 fixture 用顺序化调用模拟数据库条件更新的胜负，不代表并行 PostgreSQL 事务、真实 SSE 断线、浏览器 retry、取消与网络 write 的线性化证明。正式门槛仍需 R3 的隔离服务/数据库验收、受控提交快照和共用门槛 A。
