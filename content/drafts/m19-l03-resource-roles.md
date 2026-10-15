# M19-L03：资源归属与角色权限

## 学完后

- 将 caller、资源所属项目和操作动作一起用于授权；不把猜测不到 ID 当成授权机制。
- 从服务端 project membership 查询 Owner、Editor、Viewer，并按操作应用最小权限矩阵。
- 对不存在、路径/父资源不匹配、非成员与没有该操作权限的资源统一返回不可见结果；每个读写入口都重新检查。

## 先修

完成 M19-L01 的认证与授权边界，以及 M19-L02 的可信 session 和测试 identity 约定。本文只讨论已认证成员对项目任务的资源级权限；账号凭据和 Session 建立不在本练习重做。M19-L05 实验会在更大的任务 API 上继续应用资源归属、状态规则和统一隐藏契约。

## 角色从项目成员关系中得出

本课把角色限定在具体 project membership 中：同一人可以是 Project A 的 editor、Project B 的 viewer，并且在 Project C 没有任何关系。handler 只能从可信身份上下文拿 user ID，再查服务端 `(user_id, project_id) -> role`；客户端 JSON、path、query 中的 `role=owner` 不会改变 membership。平台级 admin 若存在，也须通过明确、可审计的服务器策略加入，不能默认跳过项目边界。

## 对每个动作定义最小权限矩阵

| 项目关系 | 读取任务 | 编辑标题/标记完成 | 将 Done 退回 InProgress |
|---|---:|---:|---:|
| Owner | 允许 | 允许 | 允许 |
| Editor | 允许 | 允许 | 拒绝 |
| Viewer | 允许 | 拒绝 | 拒绝 |
| 非成员 | 拒绝 | 拒绝 | 拒绝 |

Editor 能完成尚未完成的任务，但不能撤销已完成状态；该业务回退规则由本练习明确，不靠代码中一个笼统的 `is_admin` 或 `is_member` 分支推断。增加新动作时必须在矩阵里给出 allow/deny，再把它作为代码和测试共同契约。

## 同时绑定 path、对象归属和成员关系

对 `GET /projects/{project_id}/tasks/{task_id}`，服务端要确认 task 存在、`task.project_id == path.project_id`，再按这个 project 查当前用户的成员关系，并按 read 动作判定。PATCH 必须对同一任务和本次更新动作重新走授权。只在项目列表页检查一次、只检查“用户是任意项目成员”、或只用 task ID 查全局任务表都会留下越权路径。

```rust
let task = store.task(&task_id).ok_or(ResourceUnavailable)?;
if task.project_id != path_project_id {
    return Err(ResourceUnavailable);
}
let role = store
    .membership(principal.user_id, &task.project_id)
    .ok_or(ResourceUnavailable)?;
if !role.permits(action_for(&task, &requested_patch)) {
    return Err(ResourceUnavailable);
}
```

这是授权顺序的教学片段。真实 SQL 查询可以把 project membership、父子路径和任务 ID 一起作为条件，减少越权读和竞态；但查询条件的实现仍要有跨项目测试。不可预测 UUID 只能作为纵深防御，不能代替对象级权限。

## 统一隐藏不可见资源

本课契约把匿名 caller 返回 401 `authentication_required`，把不存在、无项目 membership、角色不能执行该动作及 path-parent 不匹配统一返回 404 `resource_unavailable`。对于不能知道对方是否有资源的用户，404 不透露任务存在性和项目成员关系；公开 error body 使用固定 code/message，不回显 owner、内部 role 或被猜测的记录值。输入格式错误可返回独立 422，但不能把它变成判断资源是否存在的侧信道。

## 请求体不是授权管理接口

PATCH schema 只接受本次允许编辑的业务字段，例如 `title` 和 `status`。不要把数据库内部对象直接反序列化为更新目标，也不要默默接收 `user_id`、`project_id`、`owner_id` 或 `role`。未知字段应按契约拒绝；membership 变更必须有单独受控 API、权限策略和审计，而不是随任务标题一起 mass-assign。

## 逐行验证角色矩阵

用不同用户和同一项目资源，从完整 Router 覆盖 owner/editor/viewer/outsider；每个 HTTP 方法、状态转换和对象路径都作为独立 action。再覆盖猜测 task ID、把 project path 换成另一个项目、client 注入 owner role、不存在任务与不可见任务响应一致。只对权限 helper 写单元测试不够，因为缺失的路由检查、extractor/body schema 和 response 映射仍可能绕过 helper。

## 分层提示

1. **范围提示**：同一个用户在两个项目能有不同角色吗？没有 membership 时，角色由什么默认值决定？
2. **矩阵提示**：Viewer 能读、能改标题吗？Editor 与 Owner 在 Done 回退动作上有什么差别？
3. **对象关系提示**：为什么读取 task ID 之后还要验证 `task.project_id` 与 URL 中的 `project_id` 相等？
4. **猜测提示**：若 UUID 很难猜，拿到其他人分享的 URL 后还要不要授权？
5. **响应提示**：如何让不存在、非成员与 path 不匹配都不暴露资源存在性？
6. **请求体提示**：PATCH schema 允许哪些字段？如果收到 `role=owner`，如何证明 membership 没被变更？
7. **测试提示**：如何用完整 HTTP 请求证明 reader 不可写、editor 不可回退、owner 可以回退，同时验证路径篡改和错误响应一致？

## 来源

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)：最小权限、默认拒绝、逐请求授权以及对象级访问控制。
- [OWASP IDOR Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html)：操纵 URL/参数 ID 的对象越权，UUID 不替代对象级权限，并示范对敏感资源以同一 404 隐藏。
- [OWASP REST Assessment Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Assessment_Cheat_Sheet.html)：对 JSON API 添加 role/internal ID 等契约外字段检查 mass assignment，并验证后续行为结果。

本课 Owner/Editor/Viewer 权限和 task 状态回退规则是明确给出的原创产品契约；授权和 IDOR 原则按 OWASP 来源核对。作者侧 in-memory fixture 不代表平台级 IAM、数据库事务或正式 R3 验收。
