# M21-L05 实验：注入三种服务故障并写诊断报告

## 实验目标

从给定基线开始，逐一模拟连接池等待、慢查询和队列堆积，记录能区分它们的 signals，提出一个可证伪假设，选择一次小型缓解操作并解释验证结果。每个场景都要恢复基线后再进入下一个，不把同时改变多个变量的结果归因给单一原因。

## 先决条件与环境边界

完成 M21-L01–L04。练习包提供三份固定版本的 synthetic scenario cards，使你能先练习故障注入与报告结构。它们是**桌面演练证据数据，不会实际耗尽 SQLx pool、执行慢 SQL 或积压 live queue**。正式实验必须在 R3 隔离环境使用实际服务和受控注入，并由平台执行恢复/清理；本 Windows 作者侧预写没有运行真实数据库或 Linux 容器。

## 每轮开始和恢复

Starter 解压到全新目录并按 manifest 校验。保留 `baseline.json` 为只读原件；每轮复制 scenario 到单独的 `attempts/<scenario>/input.json`，写入报告后丢弃尝试目录。每个场景通过检查列表证明 baseline 已恢复，不要把上一次变更继续带入下一轮。

在正式 R3 实验中，环境负责人先保存镜像版本、样本数据 hash、初始 pool/worker 参数和清理步骤；只通过受控开关启用一个 injection，验证自动超时/停止路径，再等待所有连接、worker 和队列返回基线。若 cleanup 失败应立即停止并隔离环境，不把残留故障交给下一学员。

## 三种受控场景卡

Starter 的 `scenarios.json` 给出三个合成场景：

1. **连接池等待**：`acquire_wait_p95_ms` 增长，`pool_in_use == pool_max`，但 query p95 保持低位。假设连接长时间借出/池容量限制导致排队；列出网络建立、健康检查等替代解释。
2. **慢查询**：query p95 上升，pool acquire wait 仍低，连接数没有达到 max。假设 query/锁等待路径变慢；指出真实实验要查哪些 DB 侧证据。
3. **队列堆积**：queue depth 向 max capacity 接近，enqueue rate 高于 dequeue rate，数据库 p95 与 pool wait 尚正常。假设 worker 消费速率或下游背压不足；说明一次可控 worker 变量变更的预期。

每份输入还包含未注入 baseline、单一干预后的结果和次要干扰信号。不要把 synthetic values 当成生产事实或 R3 真实采集值；它们用于练报告里的推理链。

## 实验步骤

1. 从干净 ZIP 解压，核对五个文件的 SHA-256 manifest，记录工具版本和 starter snapshot hash。
2. 先看 baseline：记录 query/acquire/queue 的单位、时间窗、容量、样本来源与缺失值；把 route/query family 用稳定名字表示，不抄入秘密或每用户标识。
3. 每次只打开一个 scenario card。写出观察事实、根因假设、预测和至少一个反证条件。
4. 用课程包提供的注入/缓解描述比较输入与 after snapshot。指出哪些指标改变、哪些保持不变；说明若预测没有发生，下一步怎样修正假设。
5. 使用 `report-template.md` 写症状、证据、假设、注入、恢复确认、回归测试和限制。将三个场景的结论分开保存。
6. 从原 ZIP 新解压再核对 baseline，确认上一轮的输入副本、报告和 target 构建产物没有改写原始快照。

## 完成检查

- 报告指出至少两个独立信号，并保留时间范围、单位、基线及变更后值。
- 诊断假设可以被新证据推翻；每个缓解动作一次只更改一个变量。
- 每轮检查正确区分“现象缓解”“假设获得支持”与“根因证实”。
- 回归测试针对观测边界；没有依据把 `max_connections` 或 worker 数无条件调高。
- 复位步骤完成，scenario input 与原始 ZIP hash 未改变。

## 已知错误变体

错误报告把所有延迟都叫“慢查询”、把请求 ID 当成 label、加倍 pool size 后同时改变 worker 数，并且没有回滚原始 scenario。按完成检查应因缺乏跨信号证据、变量混杂和无法重置而不通过。

## 恢复说明

本地练习只删除自己的 attempt copy 并重新解压原 ZIP；原 ZIP 与 baseline 永不编辑。正式 R3 teardown 由环境编排器负责撤销 injection、取消任务、清理队列/连接、恢复镜像快照并输出 cleanup 证据。发生 cleanup 错误时隔离资源并记录平台故障，不将学员技能降为失败，也不得继续给下一轮分配此环境。

R3 的实际 pool exhausted、慢 SQL 与 worker backlog 注入、验证和恢复仍需独立执行并记录；此课程草案不能用 synthetic cards 冒充完成。
