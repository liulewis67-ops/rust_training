# I02-F02 Windows 验收记录

- 日期：2026-10-12
- 状态：DONE
- 环境：Windows 原生 PowerShell 7.6.5、Node.js v22.19.0、pnpm 11.1.3。

## 来源审核

课包正文、术语定义和代码示例为原创内容，Rust Book 仅作概念核对，没有复制其正文。上游 [`rust-lang/book` 的 CONTRIBUTING.md](https://github.com/rust-lang/book/blob/main/CONTRIBUTING.md) 说明仓库采用 MIT/Apache-2.0 双许可；相应许可文本位于[上游 LICENSE-MIT](https://github.com/rust-lang/book/blob/main/LICENSE-MIT) 和 [LICENSE-APACHE](https://github.com/rust-lang/book/blob/main/LICENSE-APACHE)。课包记录了许可依据、2024 Edition 的适用章节和核对日期，来源链接也在生成页面中显示。

## Windows 验证

1. `pnpm content:validate`：通过，输出 `Valid course pack: borrowed-text@1.0.0`。
2. `pnpm check`：通过。Prettier、ESLint、TypeScript、13 个测试文件中的 68 项测试及 Vite 生产构建全部通过。
3. 生产构建生成 `dist/lessons/borrowed-text-first-token/index.html`。PowerShell 检查确认页面包含术语、代码示例和来源链接，不含 `<script>`，也不含私有评测 ID `borrowed-text-hidden-check`。

课程页不依赖 JavaScript；公开清单只列入显式发布的课包。生成器限制来源审核状态和资源可见性，不读取独立私有评测文件，并对正文、代码及属性转义，只允许 HTTPS 来源链接。

本次没有运行 Linux、WSL、Docker 或容器命令。I01-F06 的 Linux 隔离验收仍按用户要求保持未执行。
