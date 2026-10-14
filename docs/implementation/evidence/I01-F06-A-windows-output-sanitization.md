# I01-F06-A · Windows Runner 输出净化

- 日期：2026-10-15
- 环境：Windows PowerShell、Node.js v22.19.0、pnpm 11.1.3
- 范围：在 R1 Runner 将进程输出或诊断写入宿主终端前，将终端控制序列与危险文本控制符变为不可执行文本。

## 行为与覆盖

- 移除 ANSI/VT 与 OSC 控制序列。
- 将 NUL、其他控制字符、单独回车和双向文本覆盖字符转义为可见文本；保留换行和制表符。
- Docker 子进程 stdout/stderr、错误捕获的诊断、清理重试/待处理通知、阶段计时与 Runner 主错误路径全部使用同一输出净化函数。
- 静态搜索确认 Runner 不再直接调用 `process.stdout.write` 或 `process.stderr.write`。

## 验证

- `pnpm exec vitest run src/scripts/r1-container-runner.test.ts`：通过，13 项测试通过。
- `node --check scripts/r1-container-runner.mjs`：通过。
- `pnpm exec prettier --check scripts/r1-container-runner.mjs scripts/r1-container-runner.d.mts src/scripts/r1-container-runner.test.ts`：通过。
- `pnpm exec eslint src/scripts/r1-container-runner.test.ts`：通过。
- `git diff --check`：通过。

未执行 `pnpm r1:image`、`pnpm r1:run` 或其他容器命令。本子阶段只验证终端文本安全，不证明镜像、隔离、资源限制、网络或清理行为；I01-F06 仍为 BLOCKED。
