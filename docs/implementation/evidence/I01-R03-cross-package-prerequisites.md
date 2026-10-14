# I01-R03 跨课程包先修引用验收记录

- 日期：2026-10-14；执行人：Codex。
- 环境：Windows 11、Node.js 22.19.0、pnpm 11.1.3；未运行 Linux 容器。
- 范围：课程包可选 `external_prerequisites`、显式版本化依赖包加载、引用解析与跨包环检测；不涉及课程发布或 R1 执行。

## 实现

- Schema 为 lesson 增加可选外部先修列表，每条记录精确包含 `course_id`、SemVer `version` 和 `lesson_id`；既有 `prerequisites` 继续表示同包内单元 ID，旧包无需修改。
- 校验 API 接收显式 dependency package 列表；所有包的本地及外部先修边均加入统一有向图，校验缺失引用并拒绝自引用、重复包和跨包循环。
- CLI 增加可重复的 `--dependency <course-pack.json>`，对缺文件和格式错误返回非零状态。
- 示例 M02-L01 仍保留对 M01-L06 的真实先修，使用 M01 模块包的课程 ID、版本及单元 ID 完成显式解析。

## 验收结果

1. `pnpm check`：通过。Prettier、ESLint、TypeScript、Vitest 22 个测试文件/121 项测试及 Vite 构建均通过；生产构建转换 1630 个模块。
2. `pnpm content:validate`：通过，输出 `Valid course pack: borrowed-text@1.0.0`，确认旧课包无须外部依赖仍保持兼容。
3. `node scripts/course-content.mjs validate content/drafts/m02-l01.course.json --private content/drafts/solutions/m02-l01-private-assessment.json --dependency content/drafts/m01-rust-foundations.course.json`：通过，输出 `Valid course pack: m02-values-functions-control-flow-draft@0.1.0`。
4. 同一 M02 课包不提供依赖包时失败并报告缺少 `m01-rust-foundations-draft@0.1.0`；加载课程 ID 匹配但版本为 `0.2.0` 的包仍失败。
5. 课程内容测试覆盖外部包精确匹配、缺包、错版本、缺单元、自引用、跨包先修循环，以及重复 CLI `--dependency` 参数加载两个不同课包。
6. CLI 未知参数和缺少 `--dependency` 值返回状态码 2 及用法说明；指定不存在的依赖文件返回状态码 1 和文件路径诊断。
7. `git diff --check`：通过。

I01-R03 按独立工程阶段验收；不解除 I01-F06 的 Linux 容器暂缓，也不将 M02-L01 标记为课程验收完成。
