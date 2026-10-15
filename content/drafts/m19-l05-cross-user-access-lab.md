# M19-L05：实验——阻止跨用户读取任务

## 实验目标和先修

完成 M19-L04 后，从一份存在 IDOR/BOLA 缺陷的 Axum task API 起始模板开始，逐项修复跨用户读取、跨项目路径替换和越权写入。完成后，授权成员仍能读写其范围内任务，不可见资源不会泄露数据，也不能被拒绝请求偷偷改变。

课程实验使用固定 in-memory store 和由测试 adapter 写入的 `VerifiedIdentity`。该身份只代表可信服务端认证上下文，不允许由请求 JSON、URL 或 query 指定。这里不实现身份供应商、Session、PostgreSQL 或生产 IAM；正式隔离 HTTP/DB 环境仍待 R3 验收。

## 起始状态

fixture 有两个项目：project-1 包含 Owner 1、Editor 2、Viewer 3 和任务 task-101；project-2 包含 Owner 4 和任务 task-202。起始代码保留已认证检查，但按 task ID 全局读取，并计算后丢弃 parent-path 和 membership 判定；PATCH 同样会继续执行更新。这样学生可以从完整 Router 测试观察“已登录”不等于“有权访问这个对象”。

## 公开契约和修复边界

- 每个 read/write 请求都从 trusted identity 开始，按 path task ID 载入服务端任务，并核对 `task.project_id == path.project_id`。
- 角色来自 `(user_id, task.project_id)` 的 server-side membership：Owner/Editor 可以读写，Viewer 只读，非成员没有默认角色并拒绝。
- 未登录返回 401 `authentication_required`；missing、非成员、role-denied、task path 与父项目不匹配统一为 404 `resource_unavailable`。
- 拒绝 PATCH 后重新由 Owner 读取数据，确认标题没有变化；普通成员的合法 PATCH 要成功。
- 未知 PATCH 字段拒绝，客户端不能通过 payload 改 owner/project/role；错误体不回显数据库值或判定细节。
- 仅 helper 单元测试不足；公开验收通过 Router 发完整 HTTP 请求，并包含正向与反向案例。

## 工作循环和验收

1. 查看 `README.md` 的固定身份与角色夹具，执行 `cargo test --locked` 并保存失败行。
2. 将授权检查分别放在 GET 和 PATCH 的对象边界；首先比较资源实际 parent，再使用 trusted user 查当前项目 membership 和 action。
3. 重跑公共 Router 合约；至少一个错误基线必须失败，修复后全部通过。执行 `cargo fmt -- --check`、严格 Clippy 和 Rustdoc。
4. 调用 `node scripts/snapshot.mjs repaired-01` 生成带标签的源文件 SHA-256 记录。
5. 调用 `node scripts/reset.mjs` 恢复版本 `0.1.0`，验证原始漏洞和预期失败重新出现；然后恢复已保存修复并重新记录快照。

重置只覆盖 `src/lib.rs` 并清除临时 `submission-snapshot.json`，不会修改测试或用户其他目录。snapshot 只保存本练习源文件摘要、基线版本和标签；它提供可追溯性，不是 Git commit，也不是独立学习者验收的替代。

## 分层提示

1. 第一轮只检查匿名请求，可以抓到安全代码的哪一个边界？为什么它拦不住已认证攻击者？
2. task ID 从 path 来，但 task 的 project ID 来自哪里？修改 project path 后，任务的 parent 关系应该怎样比较？
3. membership key 应由哪个 identity 与哪个 project 构成？`None` membership 应当拒绝还是给默认角色？
4. Read 和 Edit 的矩阵是什么？Viewer 正常读取的正向测试为何也要保留？
5. 看到 404 后还应检查什么，才能证明 PATCH 没有先写入再返回错误？
6. 如何让真实不存在、其他用户拥有与父路径不匹配的资源使用一致的外部错误？
7. 你保存的 SHA-256 对应哪个文件、标签与课程 baseline 版本？如何证明确实能 reset 回同一初始状态？

## 来源

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)：默认拒绝并对每一个请求验证权限。
- [OWASP IDOR Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html)：以多个用户和资源测试对象级授权；随机或难猜 ID 不能替代每对象权限检查。

角色矩阵和任务 fixture 是本课程原创契约。in-memory Router 测试只证明此练习程序的本机行为；不证明并发 SQL 查询、生产身份上下文、数据库行隔离、Linux R3 或共用门槛 L。
