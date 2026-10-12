# I02-F06 Windows 验收记录：云端工作区同步

日期：2026-10-12（Asia/Shanghai）

环境：Microsoft Windows 11 家庭版 中文版，版本 10.0.26300；Node.js v22.19.0；pnpm 11.1.3；rustc 1.95.0；Cargo 1.95.0。

数据库：SQLite，测试使用独立内存数据库；开发运行配置由 `DATABASE_URL` 指向 SQLite。
执行方式：原生 Windows PowerShell；未运行 Linux、WSL 或 Docker 验证。

## 自动验证

| 命令 | 预期 | 实测 |
|---|---|---|
| `pnpm check:frontend` | 格式、ESLint、TypeScript、测试和生产构建全部通过 | 通过：18 个测试文件、87 项测试；Vite 构建成功 |
| `pnpm check:backend` | rustfmt、Cargo check、Clippy、Rust 测试、文档检查全部通过 | 通过：10 项 Rust 测试；格式、编译、Clippy、文档检查通过 |

关键行为覆盖：

- 两个使用同一 owner 的独立 SQLite Session 可恢复同一工作区；新 revision 写入后，旧 revision 保存返回 409。
- 409 响应含最新云端文本与提交文本，二者均持久保存；选择保留本机版本时，被替换的云端文本也归档到冲突历史。
- 未登录及跨 owner 读、写、解决冲突均拒绝；owner 来源只能是服务端 Session。
- 前端空白设备恢复云端版本；保存冲突明确展示两个版本并提供选择；选择本机版本走专用解决接口。
- 课程草稿仍在 IndexedDB 保存；SQLite API 错误不伪报云端成功；请求长度和草稿内容均有上限。
- 已登录时 IndexedDB 键按服务端 `user_id` 隔离；未登录草稿沿用匿名命名空间，无法读取另一账户的本地副本；会话请求不可用时使用独立 offline 命名空间。

## 手工复现步骤

1. 启动已配置 SQLite 和 OIDC 的后端及 Vite 前端，在浏览器登录。
2. 打开含 `DraftEditor` 的代码示例，编辑后点击“保存并同步”；预期显示云端同步成功。
3. 在另一独立浏览器会话登录相同账户，打开同一课程、条目和模板版本；预期恢复最新云端代码。
4. 两端先读取同一 revision，再分别改动并保存；后保存端看到冲突提示，同时可展开本机与云端版本。
5. 选择“保留本机版本”；预期所选文本成为新 revision，被替换的云端内容与过期提交均在冲突历史中保留。
6. 使用另一账户尝试读取/写入第一账户的 workspace ID；预期返回 404，不泄露资源存在性。

手工多账户浏览器验收未执行；本任务使用真实 Axum 路由、SQLite 和测试 Session 完成等价的 API/权限集成覆盖。OIDC 提供方配置仍属于 I02-F05 的独立阻塞项，不将其冒充为本任务已完成。
