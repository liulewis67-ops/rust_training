# M22-L03：三道短练习

## 1. 预测：滚动窗口会怎样？

有 3 个旧版本 Ready 副本，更新策略 `maxUnavailable: 0`、`maxSurge: 1`。新版本的 startup 已成功，但数据库迁移进行中导致 readiness 失败，liveness 仍成功。预测哪些实例保留流量、controller 是否会继续缩减旧副本，以及哪个信号触发重启。

**契约**：分开 startup/readiness/liveness，结合副本约束说明 rollout 停滞；不得把 readiness 失败解释成必然重启。

## 2. 修复：失败测试仍然部署

给定 workflow 把测试 step 标为 `continue-on-error: true`，deploy job 没有 `needs: test` 且使用 `if: always()`。修复 job 依赖和部署条件，并说明 branch protection 要求哪个实际 check 成功；指出 path-filtered workflow 可能留下 required check pending 的风险。

**提示**：本题只修依赖图，不是假装已经设置仓库保护规则或运行远端 action。

## 3. 测试补全：健康状态与 probe

完成 starter `probe_report(state)` 并补足公开合同测试：Starting 不 Ready；Ready 三项成功；DependencyUnavailable 不接流量但不应触发 liveness 重启；Stalled 令 readiness 与 liveness 失败。

**契约**：纯函数对四种状态返回确定信号，CI 中 `cargo test` 任一失败须令 verify job 失败；不连接下游服务或触碰进程环境。
