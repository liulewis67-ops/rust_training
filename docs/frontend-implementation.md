# 纯前端改版实施记录

目标方案：[frontend-only-plan.md](./frontend-only-plan.md)。开始日期：2026-10-16。

## FE01 资产与范围整理 · DOING

- 已建立纯前端方案为现行入口，并在旧 PRD、技术设计、课程设计、实施台账和前端规范页首标出历史状态。
- 已将 README 改为当前开源学习站说明，并补充 MIT 软件许可、CC BY 4.0 原创内容许可和贡献指南；逐文件来源与权属盘点尚未完成。
- 当前仓库 `main` 工作区包含大量既有未提交课程资产和历史修改。本次移除了已取消的后端、runner、账号与云端工作区代码；未暂存、改写或删除未跟踪的课程资产。
- 按用户给出的地址将 `https://github.com/liulewis67-ops/rust_training.git` 设置为本地 `origin`。检查时远端没有分支引用，尚未推送或触发 Pages。

## FE02 纯前端学习闭环 · DOING

- 学习状态 Hook 已移除账号查找、云端合并、同步重试、账户时区接口和云导入流程，保留本地阅读、答题及手动完成记录。
- localStorage 新记录带 schema 版本、按 Pages 路径命名空间，并将最近作答限制为 200 条；可读取兼容的 root 部署匿名旧记录。子路径部署不读取或清理未命名空间的旧共享键。
- 增加只清理本站学习 key 的操作。存储不可用时改为内存记录，损坏数据保留原文。
- 应用导航移除登录和作者预览入口；旧练习页不再加载云工作区与运行任务编辑器；课程示例改为可复制代码。本地记录不是能力认证。移除无用的 IndexedDB 测试依赖。
- 登录、云同步、编辑器、执行服务、沙箱与 runner 的源文件已从活跃仓库删除；相关旧测试也已退出质量流水线。
- Markdown 渲染会过滤脚本、样式与危险内嵌 HTML；首页不再展示旧版课程完成数量。
- `pnpm check:frontend` 最新通过格式、ESLint、TypeScript、12 个测试文件／71 个用例和根路径生产构建；单独的 `/rust_training/` 子路径构建也通过，首页引用的 JS/CSS 均带正确前缀。
- 仍有旧版 UI 样式需清理。

## FE03 静态部署适配 · DOING

- 应用内部导航改用 Hash 路由，可在静态托管下直接使用课程、复习和进度路径。
- Vite `base` 可通过 `PAGES_BASE_PATH` 配置；新 Pages 工作流针对该仓库的 `/rust_training/` 路径构建，并以 Actions artifact 发布。
- 主应用停止注册 Service Worker，Vite 构建去除旧课程页／离线预缓存生成和 `/api` 开发代理。
- 添加 `public/sw.js` 作为旧 `/sw.js` 的一次性退役脚本，更新时注销本站旧 worker 并清理 `rust-path-shell-` 缓存；是否覆盖过往部署地址需检查线上实际 URL。
- 目录不再把空课程渲染为可点击入口；顶部课程与 GitHub 入口指向本仓库。
- 搜索链接改为 Hash 地址；公开课包统一进入 React 阅读器，旧独立 HTML 不再作为搜索目标。
- 以 `/rust_training/` 构建后通过本地静态目录映射检查：主页、JS、CSS、`sw.js` 均返回 200，JS/CSS MIME 类型正确；Vite `preview` 自身不映射仓库子路径，不能代替 Pages 实测。
- 尚未在真实 Pages 地址完成直达、刷新、前进后退、下载检查或部署。仓库 Pages 设置也尚未确认。

## FE04 首批课程发布 · DOING

- `content/public-course-manifest.json` 现在同时控制公开 JSON 课包和 Markdown 课节；站点只从 `content/releases/` 加载获准的 Markdown 与 ZIP，`content/drafts/` 不再参与课程目录或搜索。
- `pnpm content:validate-public` 检查清单格式、公开来源状态、资源路径、课节引用和 ZIP 文件存在性，并已通过当前清单（1 个公开课包，0 个 Markdown 课节）。
- 已把清单中原本公开的 `borrowed-text` 课包接入 Hash 阅读器，补齐其公开练习说明资源；搜索结果可打开该课节。
- `markdown_lessons` 当前为空。M01–M03 的作者预检不构成正式发布验收；现有课包仍标为 private/draft，且引用私有评测 ID。还需逐节核验本地命令、起始项目、提示、参考材料和来源，再改写发布版本、复制到发布目录并列入清单。

## FE05 开源与 Pages 首发 · DOING

- 根目录软件代码采用 MIT License；原创课程和文档采用 CC BY 4.0，第三方材料按其原许可处理。
- 新增 `CONTRIBUTING.md`，说明软件检查、课程发布清单和来源记录要求；原创材料与第三方来源的逐文件授权核查仍未完成。
- GitHub Actions 已配置前端质量与 Pages artifact 发布；本地根路径和 `/rust_training/` 构建均通过。远端仓库当前没有分支引用，Actions 与 Pages 设置尚未运行或确认，因此没有真实部署结果。

## 未完成项

FE01–FE06 均未完成。前端质量检查、公开清单校验和根／Pages 子路径构建已通过；正式课程发布、逐文件来源核查、远端推送及实际 Pages 部署和线上验收仍待完成。本记录只把上方明确列出的本地检查标记为通过。
