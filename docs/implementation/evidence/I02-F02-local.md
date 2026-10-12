# I02-F02 Windows 本地进展与阻塞记录

- 日期：2026-10-12
- 状态：静态页面生成能力已实现并通过本地检查；任务因缺少来源已审核的课包保持 `BLOCKED`，不代表公开课程页验收完成。
- 环境：Windows 原生 PowerShell 7.6.5、Node.js v22.19.0、pnpm 11.1.3。

## 已验证的本地能力

- `pnpm exec vitest run src/scripts/course-page-renderer.test.ts`：4 项测试通过，覆盖来源许可门槛、公开资源检查、无脚本 HTML、正文转义、HTTPS 链接、公开示例和提示字段，以及静态路径生成。
- `pnpm check`：通过。Prettier、ESLint、TypeScript、68 项 Vitest 测试及 Vite 生产构建通过。
- `git diff --check`：通过。
- Windows 生产构建使用空的 `content/public-course-manifest.json`，未生成 `dist/lessons` 静态页面。

静态生成仅处理显式列入公开清单、`visibility` 为 `public`、来源许可状态全部为 `approved` 或 `original`、且资源均为公开的课包。页面不含 JavaScript，不读取独立私有评测文件，只渲染课包列明的正文、先修、公开样例、提示和来源；Markdown 与所有属性均转义，链接只接受 HTTPS。

## 阻塞条件

当前唯一课程包 `content/borrowed-text.course.json` 的来源许可状态为 `review_required`，不符合公开静态生成条件，因此保留在清单之外。解除条件：提供已完成来源审核的课包（来源状态为 `approved` 或 `original`），再加入公开清单并验证实际生成页面。

本任务没有运行 Linux、WSL、Docker 或任何容器命令。I01-F06 的 Linux 隔离验收仍未执行。
