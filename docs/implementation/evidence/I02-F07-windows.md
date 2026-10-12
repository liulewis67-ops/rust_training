# I02-F07 Windows 验收记录

- 日期：2026-10-12
- 环境：Windows NT 10.0.26300.0；Rust/Cargo 1.95.0；Node.js 22.19.0；pnpm 11.1.3
- 数据库：SQLite；后端集成测试使用 `sqlite::memory:`，启动时通过既有 `DATABASE_URL` 对目标 SQLite 文件应用 `0003_learning.sql`。
- 验收对象：账号学习记录的 SQLite API、前端本地/云端合并、反思与自评提交、账号时区和日期计算。

## 验收结果

| 检查 | 输入/步骤 | 预期 | 实测 |
|---|---|---|---|
| 账户隔离与读取 | 通过服务端 Session 分别请求学习状态；另一个 owner 读取原 owner 数据 | 相同 owner 可从新设备恢复；不同 owner 不可读取 | 通过；owner A 的另一设备恢复课程位置，owner B 收到 404 |
| 完成、反思和自评 | 以已登录测试 Session 提交完成记录、反思和 1–5 自评分 | 数据写入 SQLite 并在快照返回；自评独立于自动评测结果 | 通过；请求 DTO 不接收客观答题答案或正确性，前端只上传 `self_assessments` |
| 幂等与时区 | 重放相同 event ID，再提交另一设备事件，修改账户时区 | 同一事件不重复增加修订/学习日；不同设备使用账户时区；时区修改重算历史学习日 | 通过；测试覆盖重复事件、`America/Los_Angeles` 日界和改为 `Asia/Shanghai` 后的历史日期重算 |
| 本地恢复和账号切换 | 浏览器存储损坏/配额不足、异步恢复答案、退出账户 | 损坏数据不被覆盖；写入失败有提示；登录身份决定本地键；退出清除界面私有状态 | 通过；前端测试覆盖相关恢复、错误提示及每个账户独立的本地存储键 |
| 时区日期算法 | 同一 UTC 时刻分别按 `America/Los_Angeles` 和 `Asia/Shanghai` 计算；检查跨日、闰日及夏令时 | 使用 IANA 时区和日历日期，不以固定 24 小时推算昨天 | 通过；前端日期测试及后端连续学习日/闰日测试通过 |
| 前端质量检查 | `pnpm check:frontend` | 格式、lint、TypeScript、测试和生产构建全部通过 | 通过；19 个测试文件、92 个测试通过，Vite 生产构建通过 |
| 后端质量检查 | `pnpm check:backend` | rustfmt、check、clippy、cargo test、cargo doc 全部通过 | 通过；14 个 Rust 测试通过，文档构建通过 |
| 差异检查 | `git diff --check` | 无空白错误 | 通过 |

上述命令均在 Windows PowerShell 原生环境运行；本验收没有调用 Linux、WSL 或 Docker 验证。

## 迁移、配置和回退

- `0003_learning.sql` 只新增学习记录表和索引，不修改或删除既有数据。后端使用项目已有的 `DATABASE_URL`；无需新增密钥或服务。
- 回退应用版本时保留学习记录表和数据，不执行 `DROP`。恢复旧应用前备份 SQLite 文件，并确保旧版本不依赖新表；若需回滚学习记录功能，应通过兼容代码停用读写，不删除已保存记录。
- 新增 `jiff` 固定版本依赖用于服务端 IANA 时区换算，版本记录在 `backend/Cargo.lock`。

## 限制

- 真实 OIDC issuer/client 尚未配置，无法做真实提供方登录的跨浏览器端到端验收；此项仍由 I02-F05 跟踪，不影响本阶段用测试 Session 验证 SQLite API。
- 集成测试使用内存 SQLite；启动配置会将迁移应用于 `DATABASE_URL` 指向的文件库。尚未对用户提供的真实 SQLite 文件做迁移演练。
