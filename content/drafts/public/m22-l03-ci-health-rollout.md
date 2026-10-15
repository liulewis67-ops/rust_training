# M22-L03：CI、健康检查与滚动更新

## 学完后

- 设计 required CI check，使格式、构建、测试或发布前验证失败时部署/合并不会继续。
- 区分 startup、readiness 和 liveness 信号，针对不同失败选择“继续启动、停止接流量、重启进程”。
- 解释滚动替换如何结合 readiness 与 `maxSurge`/`maxUnavailable`，并说明应用兼容和回滚边界。

## 先修与环境

先修 M22-L01 release/目标平台和 M22-L02 启动配置。正式课程前置和 I12-F08 尚未通过。本课附 Rust 进程内健康状态模型和静态 GitHub Actions 示例；作者侧在 Windows 跑本地 crate contract，不执行 CI 工作流、部署、Kubernetes API 或滚动更新。

## CI 是发布决策的门

CI 步骤退出码必须传播给 job。需要验证的 lint、format、build、测试与产物检查不能设 `continue-on-error`，也不能让 deploy job 在验证失败后通过 `always()` 启动。受保护分支还需把正确来源的状态检查设为 required；若工作流按路径过滤，确保必需检查不会在改动相关但被过滤的提交里永远不报告。部署 job 显式 `needs: verify`，并用目标环境的保护规则控制凭据和批准。

```yaml
name: verify-and-deploy
on:
  pull_request:
  push:
    branches: [main]
jobs:
  verify:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v6
      - run: cargo fmt -- --check
      - run: cargo test --locked --all-targets
      - run: cargo clippy --locked --all-targets -- -D warnings
  deploy:
    needs: verify
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    environment: staging
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploy only the verified immutable artifact"
```

片段用来解释依赖关系，不是仓库已启用或已运行的 workflow；实际 action 版本、runner OS、permission scope、artifact provenance 和 required-check 名称需按仓库策略固定、审查并验证。单纯出现绿色徽章不证明所有分支变更都触发检查，部署 job 也应消费 verify job 标识的不可变 artifact，而不是再构建另一个内容。

## 三类健康信号回答不同问题

- **startup**：启动过程是否完成？慢启动时可防止 liveness/readiness 在初始化期过早介入。
- **readiness**：当前是否能接收新请求？启动未完成或关键本地依赖准备失败时移出服务端点，但进程可以继续运行恢复。
- **liveness**：进程是否陷入无法自行恢复的停滞（例如死锁）？达到阈值后允许运行环境重启。

数据库短暂不可达通常应令 readiness 失败而不令 liveness 失败；否则所有副本一起重启会加剧故障。probe 必须低成本、限时、无写副作用。不要把 readiness 等同于“所有下游都健康”：逐项选择哪些依赖确实决定接流量，避免一次下游故障让全服务拓扑一起撤出。Kubernetes 的 startup probe 成功后才开始执行 liveness/readiness；readiness 失败会停止将 Pod 加入 Service 流量，liveness 失败则在阈值达到后重启容器。

```rust
match state {
    ServiceState::Starting => ProbeReport { startup_complete: false, ready: false, live: true },
    ServiceState::Ready => ProbeReport { startup_complete: true, ready: true, live: true },
    ServiceState::DependencyUnavailable => ProbeReport { startup_complete: true, ready: false, live: true },
    ServiceState::Stalled => ProbeReport { startup_complete: true, ready: false, live: false },
}
```

这个模型只展示信号分类，不是 HTTP 服务或 Kubernetes 配置。真实 handler 还要提供稳定 status code、deadline、身份/网络边界和可观测原因码；不能把数据库密码、连接字符串或内部拓扑塞进健康响应。

## 滚动替换依赖 readiness 和兼容窗口

Rolling update 逐步扩增新 ReplicaSet、等待副本 Ready，再缩减旧 ReplicaSet。`maxSurge`限制期望副本数以外可新增的数量；`maxUnavailable`限制更新期间允许不可用副本数。两项相互约束，百分比向上/向下取整也会影响小副本部署。readiness 永远不通过会暂停更新，旧副本还可能保留；部署失败应能观察进度、停止继续扩大并回到已知健康版本。

滚动发布期间 old/new 应用版本会同时服务：API、事件、数据库 schema 和配置需保持兼容；通过“先扩展可兼容 schema，再更新应用，最后移除旧字段”的窗口管理不兼容变更。镜像 rollback 不能逆转已经执行的破坏性数据迁移。可恢复性需要写出何时暂停、如何判断新旧副本健康、何种证据允许回滚，以及回滚后数据如何继续兼容。

以 3 副本、`maxUnavailable: 0`、`maxSurge: 1` 为例：新副本未 Ready 时不应减少三个旧 Ready 副本，新 ReplicaSet 只能在可用性约束内前进；若所有新副本因配置缺失不 Ready，rollout 应停止并触发诊断/回退流程，而不是忽略健康检查强行移除旧版本。

## 本地验证与正式验收边界

在本地先证明每个 health-state 的报告合同并跑 fmt/test/lint。部署环境再通过受控故障验证初始化延迟、依赖失联和进程停滞各自触发什么行为；CI 仓库端需检查受保护分支 required checks 与部署依赖，滚动更新需观察新旧副本、ready 数量、事件与回退。静态 YAML、内存单元测试和本地 smoke run 不能替代 runner、平台和运行中服务验收。

## 分层提示

1. startup probe 未成功前，readiness 和 liveness 在 Kubernetes 的启动时序如何处理？
2. DB 维护导致 readiness 失败但进程仍可恢复，为什么不应立即令 liveness 同样失败？
3. 部署 job 没有 `needs: verify` 且验证任务 `continue-on-error` 时，哪条发布路径会绕过质量门？
4. 3 副本、`maxUnavailable=0`、`maxSurge=1` 且新 pod readiness 失败时，何时可以缩减旧 ReplicaSet？
5. 旧应用和新应用同时运行时，schema/API 应满足什么条件，才能让 image rollback 有效？
6. 为什么绿色 CI check 不等于目标运行环境健康？

## 来源

- [GitHub Docs：Status checks](https://docs.github.com/en/pull-requests/reference/status-checks)：required check 成功/失败与合并阻断。
- [GitHub Docs：Deploying with GitHub Actions](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments)：workflow job、environment protection、secret access 与并发。
- [Kubernetes：Startup, liveness, and readiness probes](https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/)：探针职责、启动时序和失败后行为。
- [Kubernetes：Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)：RollingUpdate、`maxUnavailable` 和 `maxSurge` 约束。

作者侧没有执行 GitHub Actions、在受保护分支配置 required checks、构建/部署镜像或调用 Kubernetes。实际平台行为、目标服务健康和回滚仍待 R2/R3 验收。
