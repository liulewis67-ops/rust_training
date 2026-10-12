# Rust 学习平台

本项目是公益导向的开源 Rust 学习项目，面向学习者免费开放课程与学习功能，以知识共享、学习成效和社区共建为目标。

React + TypeScript + Vite 的本地学习原型。保留 36 节短课、选择题与开放题自评、薄弱点复习、学习统计和深浅主题。正式平台的 144 个教学单元属于实施计划，尚未发布；当前原型数据不代表平台验证成绩。

## 本地开发

本项目在 Windows 原生环境开发，使用 PowerShell、Node.js 22.19.0 和 pnpm 11.1.3；不要求安装或进入 WSL。使用 `package.json` 固定的包管理器和已提交的锁文件。以下命令均在 Windows PowerShell 中运行。

```powershell
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm build
pnpm check
```

Vite 开发地址以终端输出为准。静态部署需要将 `/lesson/*`、`/review`、`/progress` 回退到 `index.html`。

`pnpm check` 依次执行格式检查、ESLint（含 Hook 规则）、类型检查、Vitest 回归测试和生产构建。`pnpm format` 应用共享格式；原型课程数据与旧样式暂不全量格式化。CI 使用相同步骤和 frozen lockfile 安装，失败步骤单独显示。

`pnpm content:check-samples` 使用清单锁定的 Rust 版本校验完整可运行样例、不可运行教学片段、目标编译失败、正确/错误解，并确认语法错误不会误判为指定编译错误。该工具只运行仓库内可信样例；学员代码的执行隔离属于后续 I01-F06。

I01-F06 的 Linux 容器验证目前暂缓，本地开发与验证均在 Windows PowerShell 中进行；不要运行 `pnpm r1:image` 或 `pnpm r1:run`，也不将 R1 Linux 隔离能力视为已验收。`pnpm content:check-samples` 只在 Windows 上校验仓库内可信课程样例。Linux 隔离执行仍是后续目标，其效果和安全性尚无本地实测结论。

`pnpm check:backend` 为后续 Cargo workspace 的入口：依次执行 fmt/check/clippy/test/doc；当前没有 `backend/Cargo.toml`，命令明确报“未运行”并失败。CI 同样注明后端未运行，不能视为后端验收通过。

课程包结构由 `schemas/course-pack.schema.json` 定义，私有评测单独使用 `schemas/private-assessment.schema.json`。校验示例课包和配套私有包：

```powershell
pnpm content:validate
```

校验其他文件时运行 `node scripts/course-content.mjs validate <course-pack.json> [--private <assessment-pack.json>]`。校验器会检查稳定 ID、版本、先修关系、来源/资源/练习引用、题型、环境版本和公开/私有路径边界；错误输出带字段路径。

## 项目结构

```text
src/
  app/                 应用组合、History 路由与布局
  pages/               阅读、复习、统计页面
  features/
    catalog/           原型目录、题目枚举与标签
    learning/          学习模型、存储校验与状态 Hook
    practice/          客观练习、开放练习与反馈
    reading/           课程代码示例与复制行为
    preferences/       深浅主题偏好
  components/          与课程业务无关的代码展示组件
  lib/                 浏览器存储适配器
  data/                8 节基础短课与 28 节扩展短课
  types/               共用课程与练习类型
  styles/              可访问性补充样式
```

依赖方向为 `app/pages → features → components/lib`。功能模块通过 index 导出入口使用；ESLint 阻止基础层反向引用业务模块，以及功能层引用页面。原型正文和 ID 保留在 `src/data/`；既有 `styles.css` 与 `theme.css` 保持视觉基线。

学习记录仍使用 `rust-backend-training:v1`，主题使用 `rust-backend-training:theme`。记录按运行时结构校验，损坏原文不会被默认状态覆盖；存储失败时显示内存模式提示，刷新可能丢失当前会话修改。课程与复习统一保留同题最后一次提交，历史自评分保留，并从客观题正确率中排除。连续学习按设备本地日历计算。

当前路由：`/` 恢复上次课程，`/lesson/:id` 打开旧课程，`/review`、`/progress` 打开工具页，`/preview/borrowed-text` 打开本地作者预览（不计入学习进度）。无效链接提供明确的未找到页面。移动目录支持焦点约束、Escape 关闭和焦点恢复。

本地记录依赖当前浏览器与站点 origin；备份时需另行保存浏览器数据，Git 不包含个人学习记录。没有后端、账户同步或真实 Rust 代码执行服务。

## 实施入口

按 [实施路线图](docs/implementation-plan.md) 和 [技术设计](docs/technical-design.md) 逐项交付。开发前阅读 [前端规范](docs/frontend-development-standards.md) 与 [后端规范](docs/backend-development-standards.md)。每个小阶段单独提交，验收证据保存在 `docs/implementation/evidence/`。

Git 默认分支为 `main`，仅初始化本地仓库；没有配置远程仓库。依赖、构建产物、测试输出、环境文件和密钥文件均排除在版本控制之外。

## 本轮完成范围

已完成 I01-F01（Git 基线）、I01-F02（质量入口）、I01-R01（现有前端重构）、I01-F03（课程包结构校验）、I01-F04（课程样例正反例验证）和 I01-F05（作者预览），各自独立提交。总台账为 6/231；I01 其余内容工程和隔离运行验证尚未完成。下一项是 I01-F06。完整平台、后端、正式课程和云端评测没有被计为已交付。
