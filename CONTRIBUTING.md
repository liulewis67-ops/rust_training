# 贡献指南

欢迎通过 GitHub Issues 报告课程问题、错误链接、命令环境差异和无障碍问题；也欢迎提交 Pull Request 修复或补充材料。涉及课程时，请在说明中写明课程 ID、适用系统、Rust/Cargo 版本和复现步骤。

## 修改软件

需要 Node.js `22.19.x` 和 pnpm `11.1.3`。

```sh
pnpm install --frozen-lockfile
pnpm check:frontend
pnpm content:validate-public
```

站点构建默认使用根路径。验证 GitHub Pages 项目路径时，在 PowerShell 设置：

```powershell
$env:PAGES_BASE_PATH = "/rust_training/"
pnpm build
```

## 修改或发布课程

先在 `content/drafts/` 中整理材料。只有在正文、来源、环境命令、起始文件和资源路径都经过检查后，才将面向学习者的版本放入 `content/releases/`，并把稳定课节 ID 加入 `content/public-course-manifest.json` 的 `markdown_lessons`。公开课程包要加入 `course_files`，并通过课程包与公开清单检查。草稿和教师参考材料不会因为文件存在就自动进入网站目录。

提交内容必须由提交者原创，或明确记录可兼容的来源许可。请在课程中保留来源链接、访问日期和改写说明；不要提交未授权的教材摘录、字体、图片或其他第三方材料。网站公开源码，课程参考实现与答案应按公开材料编写，不依赖浏览器端隐藏评测。

## 许可

软件代码使用 MIT License；原创课程与文档内容使用 CC BY 4.0。提交贡献表示你有权按对应许可发布该贡献。第三方内容必须保留其原有许可和署名，不能用本仓库许可覆盖。
