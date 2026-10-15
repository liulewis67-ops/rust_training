# M22-L05 实验：自动部署到隔离环境

## 实验目标

从锁定的源码快照部署一个带版本和健康端点的服务到受控环境，记录源码、构建产物和运行实例之间的对应关系；再部署一个已知错误变体，确认未 Ready 的版本不能接收流量，并恢复到先前的健康版本。每次尝试都要保留部署、探针、回滚和 teardown 证据。

## 前置与环境

完成 M22-L01–L04。正式执行还需要 I12-F08、R2/R3 隔离部署环境及任务级别 snapshot/build/deploy/health/rollback/cleanup 能力。课程包提供 Rust 服务、Dockerfile/deployment 模板、公开合同和错误变体，但当前作者侧没有运行镜像或部署平台。模板占位符必须由经过授权的课程环境提供具体镜像 digest 和 namespace；不能填虚假 digest、接真实云账户或连接生产资源。

## 一轮实验的资源边界

平台为每轮分配独立临时 namespace 和预算上限，限制可用 CPU、内存、实例数、网络目标、运行时长和日志量；只允许访问课程镜像仓库、源快照和必要的内部健康端点。学员不能创建公共 LoadBalancer、访问宿主、写其他 namespace 或注入真实凭据。所有部署使用只读源码快照/提交 ID，不允许从浮动 `latest` 拉镜像。

若平台未给出版本化构建基础镜像、runtime image、目标 platform、resource quota、端口策略、日志入口、health probe 和 cleanup 状态，停止实验并将其记录为平台未就绪，不以本地 Docker 启动代替隔离环境验收。

## 实验步骤

1. 从新 ZIP 提取起始 crate，逐项比对 `starter-manifest.json`，保存源码和 Cargo.lock hash。记录平台环境 ID、runner/runtime 版本、namespace、配额和 starter snapshot。
2. 使用环境提供的 immutable builder/runtime image references 构建 release 产物。记录 Rust target/profile、构建命令、产物 hash、镜像 digest 与源码 snapshot 的绑定关系。不得把本机 `.exe` 复制到 Linux runtime。
3. 在平台先发布 baseline。查询 `/health/live`、`/health/ready` 和 `/version`；报告必须关联应用版本、部署 revision 和 digest，并证明就绪实例只在 Ready 后接流量。
4. 做一项明确且可回退的源码变更（例如更新服务的 `APP_BUILD_ID` 默认 fixture），建立新的固定 snapshot，重新构建并部署 candidate。观察 rollout 状态、ready 实例数和事件，确认 candidate health、version 和 digest 对应同一次构建。
5. 为单独 candidate 注入 `known-bad/readiness-blocked.env` 中的 `APP_READINESS=blocked` 配置。进程 liveness 可以成功，但 readiness 持续失败；验证平台停止晋升/流量切换，并保留 baseline revision。
6. 通过平台回退到记录的 baseline revision，不手动改写数据库或覆盖平台状态。重新读取 live/ready/version、revision 和 digest；确认旧服务恢复接流量，错误 candidate 不再接收请求。
7. 执行 reset/teardown：撤销当前 candidate、删除本轮 namespace 和临时凭据，确认副本/任务/网络策略/日志保留按规定回收。保存 cleanup 结果和最终资源清单，再由新 ZIP 重开一轮。

## 完成检查

- 源码、Cargo.lock、target/profile、产物 hash、image digest、deployment revision 可互相追溯。
- 成功版本的 readiness 和 health response 来自部署中的 artifact；未 Ready 的 candidate 没有被晋升或接流量。
- 故障演练包含可观察失败、平台阻断、回到确定的已知版本和恢复后的健康请求。
- 每轮只使用自己的隔离 namespace；cleanup 有平台确认，不能只靠删除本地目录宣称资源已清理。
- 报告区分本地 crate tests、静态模板校验、真实目标环境构建、真实部署与真实回滚五类证据。

## 错误变体与停止条件

已知错误 patch 令 `/health/ready` 返回 503。错误方案是只检查进程存活、部署脚本忽略 rollout 超时、以 `latest` 覆盖 baseline、失败后重新构建旧源码却没有原 digest，或未确认 cleanup 就开始下一轮。遇到镜像来源未知、目标 platform 不匹配、隔离配额缺失、candidate 未就绪但平台仍接流量、回滚 revision 不可用或 cleanup 失败时，停止继续并上报平台问题。

## 重置与恢复

本地重置：保留原 ZIP 为只读文件，删除本轮解压副本后重新提取并校验 manifest。部署重置：先调用平台的 rollback-to-revision，再验证 baseline health 和 digest，随后由 teardown 清理本轮资源并等平台返回成功。若回滚或 cleanup 失败，隔离 namespace 并停止；平台故障单独记录，不将平台未就绪记成学员能力失败。

作者侧只验证 crate 的 Windows 原生行为、公开测试和文档/课包包结构。没有 build/push image、创建 namespace、调用 deployment API、执行 Kubernetes rollout、真实 smoke test 或 cleanup；这些是 M22-L05 正式实验必须补齐的证据。

## 来源

- [Kubernetes：Startup, liveness, and readiness probes](https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/)：检查 startup/readiness/liveness 的不同作用。
- [Kubernetes：Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)：rolling update 和不可用/额外副本限制。
