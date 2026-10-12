# I01-F06 Windows 本地开发检查记录

- 日期：2026-10-12
- 状态：部分证据；不代表 I01-F06 验收完成。
- 环境：Windows PowerShell 7.6.5、Node.js v22.19.0、pnpm 11.1.3、rustc 1.95.0。

## 已执行

- `pnpm check`：通过。Prettier、ESLint、TypeScript 检查、17 个测试文件中的 80 项 Vitest 测试及 Vite 生产构建均通过。
- `pnpm content:validate`：通过，借用文本课包有效。
- `pnpm content:check-samples`：通过，验证 5 个样例；预期失败样例的语法错误类别也被识别。
- `pnpm exec vitest run src/scripts/r1-container-runner.test.ts`：通过，12 项纯参数、预检、有界文件读取、清理顺序、引擎/环境选择、日志 endpoint 脱敏和环境清单一致性测试通过。
- `pnpm exec vitest run src/scripts/r1-cleanup-queue.test.ts`：通过，6 项本机队列持久化、失败重试、依赖顺序、活跃租约保护/心跳、过期后并发恢复、endpoint 路由和非法记录拒绝测试通过。
- `node --check scripts/r1-container-runner.mjs`：通过。
- `node --check scripts/r1-cleanup-queue.mjs`：通过。
- `git diff --check`：通过。

构建上下文通过 `.dockerignore` 仅保留 Dockerfile，避免清单或未来新增文件被带入构建请求。容器、临时卷和宿主临时源目录在创建前会登记到用户配置目录的待处理队列，记录资源名、Docker context 和 endpoint 的 SHA-256 指纹（不保存 endpoint 原文）；拒绝符号链接队列目录，Docker CLI 按 `DOCKER_CONTEXT`、`DOCKER_HOST`、当前 context 的顺序固定连接。每次运行建立 10 分钟租约，并在长时间 Docker 操作前刷新；并发启动的清理流程会跳过活跃租约拥有的资源，崩溃后租约过期再按容器、卷、宿主目录顺序恢复。成功清理后幂等移除记录；其他 endpoint 的待清理资源会被提示并保留。队列通过模拟清理器故障、活跃任务保护、心跳、租约过期和 endpoint 匹配测试，真实 Docker 故障注入待 Linux 环境验证。运行时限制集中管理，测试交叉核对 `environment.json`、Dockerfile 镜像声明和标签、Runner 镜像身份校验。日志区分构建前本地镜像标签是否存在，并分别记录镜像构建、编译和运行耗时；实际冷/热耗时仍待 Linux 环境采集。

## 尚未验收

按用户要求，本地没有运行 `pnpm r1:image`、`pnpm r1:run` 或其他 Docker 容器命令。以上检查只证明 Windows 侧代码、配置和纯函数约束可通过静态与单元检查，不证明 Linux 引擎行为。

仍需在允许的 Linux 引擎上验证镜像构建、tmpfs 卷容量、seccomp/AppArmor 实际生效、普通程序编译运行、超时/内存/输出/PID 限制、宿主秘密与网络隔离、失败清理，以及冷/热耗时。按实施台账状态规则，I01-F06 标记为 `BLOCKED`；解除条件是用户明确允许在可用 Linux 容器引擎上执行验收。这些项目完成前不计为隔离验收。
