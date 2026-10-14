# I01-R02 · 课包与样例环境一致性

- 日期：2026-10-14；执行人：Codex。
- 环境：Windows PowerShell；Node.js 22.19.0；pnpm 11.1.3；rustc 1.95.0 (59807616e 2026-04-14)；Cargo 1.95.0 (f2d3ce0bd 2026-03-21)。
- 提交定位：`git log --oneline --grep='fix(I01-R02)'`。

## 问题与修复

- 修复前，`content/borrowed-text.course.json` 声明 Rust 1.90.0，而 `content/course-samples.json` 锁定 Rust 1.95.0；`pnpm content:validate` 仍报告课包有效。
- 组合校验现要求课包环境与样例清单的 `rust_version` 和 `edition` 一致。现有借用文本课包已统一为 Rust 1.95.0、Edition 2024。
- 回归测试将课包版本改为 1.90.0、Edition 改为 2021，校验分别报告 `course.environment.rust_version` 与 `course.environment.edition` 不一致；匹配的课包无错误。

## 命令与实测

1. `pnpm test -- src/content/course-content.test.ts`：1 个测试文件、7 项测试通过，含版本与 Edition 不匹配回归。
2. `pnpm content:validate`：输出 `Valid course pack: borrowed-text@1.0.0`。
3. `pnpm content:check-samples`：输出 `Verified 5 course samples with rustc 1.95.0`，语法错误反例仍被拒绝为目标编译错误。
4. `pnpm check`：Prettier、ESLint、TypeScript、22 个测试文件的 116 项测试和 Vite 生产构建全部通过；生产构建转换 1630 个模块。

本任务只调整可信课包校验元数据与验证逻辑，不运行 Linux 容器，也不代表学员代码隔离已验收。没有数据库迁移、秘密配置或后端行为变更。
