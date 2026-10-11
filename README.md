# Rust 学习平台

React + TypeScript + Vite 的本地学习原型。保留 36 节短课、选择题与开放题自评、薄弱点复习、学习统计和深浅主题。正式平台的 144 个教学单元属于实施计划，尚未发布；当前原型数据不代表平台验证成绩。

## 本地开发

当前验证环境：Node.js 22.19.0、pnpm 11.1.3。使用 `package.json` 固定的包管理器和已提交的锁文件。

```powershell
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm build
```

Vite 开发地址以终端输出为准。静态部署需要将 `/lesson/*`、`/review`、`/progress` 回退到 `index.html`。

## 原型资产

- `src/data/`：8 节基础短课与 28 节扩展短课，保留旧课程 ID。
- `src/app/App.tsx`：当前应用、阅读、练习、复习和统计入口。
- `src/lib/storage.ts`：浏览器本地学习记录，键为 `rust-backend-training:v1`。
- `src/types/lesson.ts`：原型课程与练习模型。
- `src/styles.css`、`src/theme.css`：页面样式及深浅主题。

本地记录依赖当前浏览器与站点 origin；备份时需另行保存浏览器数据，Git 不包含个人学习记录。没有后端、账户同步或真实 Rust 代码执行服务。

## 实施入口

按 [实施路线图](docs/implementation-plan.md) 和 [技术设计](docs/technical-design.md) 逐项交付。开发前阅读 [前端规范](docs/frontend-development-standards.md) 与 [后端规范](docs/backend-development-standards.md)。每个小阶段单独提交，验收证据保存在 `docs/implementation/evidence/`。

Git 默认分支为 `main`，仅初始化本地仓库；没有配置远程仓库。依赖、构建产物、测试输出、环境文件和密钥文件均排除在版本控制之外。
