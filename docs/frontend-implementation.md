# 纯前端改版实施记录

目标方案：[frontend-only-plan.md](./frontend-only-plan.md)。开始日期：2026-10-16。

## FE01 资产与范围整理 · DONE

- 已建立纯前端方案为现行入口，并在旧 PRD、技术设计、课程设计、实施台账和前端规范页首标出历史状态。
- 已将 README 改为当前开源学习站说明，并补充 MIT 软件许可、CC BY 4.0 原创内容许可、第三方许可清单和贡献指南。M01–M03 已发布资产见[首批来源审查](./frontend-source-review-m01-m03.md)；M04 六课、四份练习和实验 ZIP 见[M04 来源审查](./frontend-source-review-m04.md)。结论只覆盖已发布资产，不覆盖草稿。
- 当前仓库 `main` 工作区包含大量既有未提交课程资产和历史修改。本次移除了已取消的后端、runner、账号与云端工作区代码；未暂存、改写或删除未跟踪的课程资产。
- 已将纯前端改造提交为 `dcb107c` 并推送到公开仓库 `https://github.com/liulewis67-ops/rust_training.git` 的 `main`；未把既有未跟踪的草稿、私有评测或临时验证目录纳入提交。

## FE02 纯前端学习闭环 · DOING

- 学习状态 Hook 已移除账号查找、云端合并、同步重试、账户时区接口和云导入流程，保留本地阅读、答题及手动完成记录。
- localStorage 新记录带 schema 版本、按 Pages 路径命名空间，并将最近作答限制为 200 条；可读取兼容的 root 部署匿名旧记录。子路径部署不读取或清理未命名空间的旧共享键。
- 增加只清理本站学习 key 的操作。存储不可用时改为内存记录，损坏数据保留原文。
- 应用导航移除登录和作者预览入口；旧练习页不再加载云工作区与运行任务编辑器；课程示例改为可复制代码。本地记录不是能力认证。移除无用的 IndexedDB 测试依赖。
- 登录、云同步、编辑器、执行服务、沙箱与 runner 的源文件已从活跃仓库删除；相关旧测试也已退出质量流水线。
- 公开课包不再把 `private_assessment_id` 带入运行数据；静态发布校验会拒绝该字段，课程构建回归确认 `dist/` 不含字段或旧评测 ID。
- Markdown 渲染会过滤脚本、样式与危险内嵌 HTML；首页不再展示旧版课程完成数量。
- Vite 与 React 插件归入 `devDependencies`，最终站点仅保留 React、图标和运行所需包；构建产物所含 React、Tailwind 预置样式及 Lucide 许可已汇总到随站点发布的第三方许可清单。
- 进度页按发布清单统计主线课节与公开专题；M01–M04 各有 6 节已发布课，复习空状态不再显示旧原型目录，并将 M01 开放题与互动错题来源分开。页面行为由本地 App 回归覆盖。
- `pnpm check:frontend` 通过格式、ESLint、TypeScript、13 个测试文件／79 个用例和根路径生产构建；输出确认 18 节正文和练习按课节拆为独立代码块，6 个公开 ZIP 作为静态资源输出。
- 仍有旧版 UI 样式需清理。

## FE03 静态部署适配 · DONE

- 应用内部导航改用 Hash 路由，可在静态托管下直接使用课程、复习和进度路径。
- Vite `base` 可通过 `PAGES_BASE_PATH` 配置；新 Pages 工作流针对该仓库的 `/rust_training/` 路径构建，并以 Actions artifact 发布。
- 主应用停止注册 Service Worker，Vite 构建去除旧课程页／离线预缓存生成和 `/api` 开发代理。
- 添加 `public/sw.js` 作为旧 `/sw.js` 的一次性退役脚本，更新时注销本站旧 worker 并清理 `rust-path-shell-` 缓存；是否覆盖过往部署地址需检查线上实际 URL。
- 目录不再把空课程渲染为可点击入口；顶部课程与 GitHub 入口指向本仓库。
- 搜索链接改为 Hash 地址；公开课包统一进入 React 阅读器，旧独立 HTML 不再作为搜索目标。
- 以 `/rust_training/` 构建后通过本地静态目录映射检查：主页、JS、CSS、`sw.js` 均返回 200，JS/CSS MIME 类型正确；Vite `preview` 自身不映射仓库子路径，不能代替 Pages 实测。
- 仓库 Pages 发布源已配置为 GitHub Actions；`85e1f17` 的部署工作流成功。真实地址 `https://liulewis67-ops.github.io/rust_training/` 返回 200，已在浏览器打开目录与公开课包，并验证课节直达刷新和返回导航。M01 下载资源在本次内容提交后仍需线上核查。
- `61de562` 的质量与部署工作流均成功；真实站点可打开 M01-L01–L06，并已确认 M01-L01 的公开参考答案按需展开。小 ZIP 已改为独立静态文件并指定下载文件名；`33634d6` 和 `43503dc` 的质量与部署工作流成功。四个真实 Pages ZIP 地址均返回 200 和 ZIP 类型，`43503dc` 对应的线上 JS bundle 含有新进度文案和公开课程入口。
- `eaf670d` 的质量与 Pages 部署工作流成功。线上首页引用的新 bundle 含有 M02 目录项；M02-L01 正文与练习 chunk、M02-L05 正文 chunk 均返回 200 和 JavaScript MIME 类型，L05 starter ZIP 返回 200 和 ZIP MIME 类型。
- M03 发布提交 `64895a5` 的质量与 Pages 工作流均成功；线上首页 bundle 含 M03 目录项，M03-L01 正文与练习、M03-L05 正文 chunk 和 L05 starter ZIP 均返回 200 及预期 MIME 类型。
- 发布边界提交 `042a7a5` 的 Quality 与 Deploy GitHub Pages 工作流均成功；线上首页返回 200，第三方许可清单返回 `200 text/plain`，线上内容与 `public/third-party-notices.txt` 的 SHA-256 一致。
- 旧 worker 的实际路径已复核：`/rust_training/sw.js` 返回 200 并提供退役脚本；网站根路径 `/sw.js` 返回 404，未发现根路径部署遗留脚本。本仓库只针对真实存在的项目站路径提供退役脚本。

## FE04 首批课程发布 · DONE

- `content/public-course-manifest.json` 现在同时控制公开 JSON 课包和 Markdown 课节；站点只从 `content/releases/` 加载获准的 Markdown 与 ZIP，`content/drafts/` 不再参与课程目录或搜索。轻量目录元数据与课文正文分离，后者仅在阅读或首次搜索时按需加载。
- `pnpm content:validate-public` 检查清单格式、公开来源状态、标题与课节 ID 一致性、资源路径、课节引用、来源段落和 ZIP 文件存在性；当前已有 1 个公开课包与 36 个 M01–M06 Markdown 课节通过。
- 已把清单中原本公开的 `borrowed-text` 课包接入 Hash 阅读器，补齐公开练习说明与参考测试；搜索结果可打开该课节，参考测试在 Rust 1.95.0 上有 3 项通过。
- M01-L01–L06 已整理为公开课节，配套练习、提示、参考答案及四个 ZIP 资源；L02–L06 的本地命令和样例有逐项核验，见[M01 发布核验](./frontend-release-m01.md)。发布清单与首页主线入口已接入 M01，线上阅读、答案展开和独立 ZIP 下载响应已确认。
- M02、M03 六节均已从草稿改写为公开课件，保留本地命令、练习、公开参考答案和来源；两份 L05 starter ZIP 均与公开源目录一致并通过逐文件哈希校验。M02 Rust 代码块 32 个正常示例可编译、5 个注明的错误示例按预期失败，L05 修复后 4 项测试通过；M03 Rust 代码块 30 个可编译、4 个注明的错误示例按预期失败，L05 修复后 5 项测试通过。两份起始项目均按设计报 E0308。

## FE06 后续内容发布 · DOING

- M04 六节及 L01–L04 四份练习已迁入发布目录，公开所有逐题答案；L05 实验和 L06 综合自测均有公开参考实现，并删除了隐藏评测、平台提交等旧概念。逐文件来源与权属见[M04 审查记录](./frontend-source-review-m04.md)。
- `pnpm content:validate-public` 现通过 1 个公开课包和 30 篇 Markdown 课节；课程目录回归确认 M04、M05 各六节发布及实验 ZIP 可解析，搜索回归覆盖 `ResourceLease` 和 `split_whitespace`。
- M04 的 30 个 Rust 代码块均通过 Rust 1.95.0 编译核验：21 个正常示例通过，9 个明确的错误／待补全示例分别按预期触发 E0382 或 E0040。L05 起始 ZIP 与 manifest 文件 SHA-256 一致，原项目按预期因 E0382 失败；参考修复后 `cargo fmt -- --check`、`cargo check --offline` 和两项测试均通过。
- M05 六节课、四份练习均已整理为公开内容，所有练习含逐题答案；L05 实验和 L06 自测含公开参考实现，已移除平台提交与隐藏评测说法。逐文件来源与权属见[M05 审查记录](./frontend-source-review-m05.md)。
- M05 的 37 个 Rust 代码块已按 Rust 1.95.0 审核：可独立编译的示例通过；借用冲突、局部引用和共享引用写入等教学反例按预期失败；答案中的函数体片段按所在函数上下文解释。公开清单通过 1 个 JSON 课包与 30 篇 Markdown 课节验证，课程样例检查核对 5 个固定样例。M05 L05 ZIP 的五个文件哈希全部匹配，归档不含 `target/`；起始项目按预期触发 E0106，修复后 `cargo fmt -- --check`、`cargo check --offline` 和 4 项测试通过。
- 前端检查通过格式、Lint、TypeScript、13 个测试文件／81 个用例和生产构建；根路径与 `/rust_training/` 子路径构建均含 M05 六课按需加载 chunk 与 L05 ZIP。M04 对应的 Quality 与 Deploy GitHub Actions 均成功，真实 Pages 首页、M04 课程 bundle 和 L05 ZIP 分别返回 200。
- M05 提交 `d20f192` 的 [Quality](https://github.com/liulewis67-ops/rust_training/actions/runs/39002896334) 与 [Deploy Pages](https://github.com/liulewis67-ops/rust_training/actions/runs/39002896260) 工作流均成功。线上 Pages 首页、M05 主 bundle、L05 课文 chunk 和 starter ZIP 都返回 200；课文 chunk 含公开参考实现，bundle 不含 `private_assessment_id`。
- M06 六节与 L01–L04 练习已迁为公开课件，逐题答案、L05 实验参考实现和 L06 Cow 自测均已公开；逐文件来源与权属见[M06 审查记录](./frontend-source-review-m06.md)。L05 起始 ZIP 的五个文件哈希匹配且不含 `target/`，原项目按预期触发 E0308。Rust 1.95.0 下参考修复通过格式、检查和三项公开测试；L06 Cow 参考测试单独运行通过。13 个官方来源链接均返回 200。
- M06 的 37 个 Rust 代码块经 Rust 1.95.0 审核：26 个独立代码块通过，11 个示例按设计展示缺失生命周期、悬垂引用或依赖本课前置类型的上下文错误。公开清单现通过 1 个 JSON 课包和 36 篇 Markdown 课节；课程目录与搜索回归已覆盖 M06。
- M06 提交前的前端回归通过格式、Lint、TypeScript、13 个测试文件／82 个用例和生产构建。根路径与 `/rust_training/` 子路径构建都含 M06 十个课文／练习 chunk 与 L05 ZIP；Pages 发布及线上检查待补。

## FE05 开源与 Pages 首发 · DONE

- 根目录软件代码采用 MIT License；原创课程和文档采用 CC BY 4.0，第三方材料按其原许可处理。
- 新增 `CONTRIBUTING.md`，说明软件检查、课程发布清单和来源记录要求；M01–M03 已发布资产的逐文件来源审查完成。运行时第三方许可文本随站点提供。
- Vite 与 React 插件已移入开发依赖，避免把构建工具声明为用户运行依赖。
- GitHub Actions 已配置锁定依赖安装、前端质量与 Pages artifact 发布；`042a7a5` 对应的 Quality 与 Pages 工作流均成功，实际站点已上线。首轮部署因 Pages 未启用失败，随后配置为 Actions 发布源。
- 首轮质量工作流停在回归测试：课程样例测试调用 `rustc 1.95.0`，而精简后的工作流漏装了该工具链；补回工具链后，线上质量工作流通过。

## 未完成项

FE01–FE05 已完成；M01–M05 已线上发布，M06 本地内容与前端回归已通过，FE06 继续推进 M06–M24。M06 Pages 发布与线上检查待完成。本站浏览器自动化受当前 Codex Work 设置限制；相关页面行为以本地 App 回归测试及已记录的线上资源检查为证。根路径 `/sw.js` 返回 404，而项目路径退役脚本可访问；结论只适用于当前真实部署地址。
