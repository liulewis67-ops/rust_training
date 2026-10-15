# M19-L03：资源归属与角色权限三道短练习

## 预测：谁能对哪个任务做什么

根据角色矩阵，预测 Owner、Editor、Viewer 和另一个项目的成员读取 task-101、编辑 task-102、将 Done 任务退回 InProgress 的状态码与最终状态。再比较真实不存在 ID、非成员猜中的 ID 和 parent/path 不匹配时的公开 error contract。

提示：先确认 task 所属 project 与 URL 是否一致，再查当前用户在该 project 的 membership，最后根据具体 action 判定。

## 修复：把通用成员检查变成对象级策略

公开 starter 只检查用户属于项目成员，导致 Viewer 也能写；还忽略项目 path 与 task 父项目是否相符，并接受 patch body 中的 `role`。修复角色矩阵、路径绑定和请求 schema。没有权限或资源不可见均按题面返回 404；非法契约字段返回 422。

提示：membership 是 `(trusted user, server-side project)` 关系；owner/editor/viewer 的权力不能由请求体升高。

## 补全测试：封住角色和 ID 越权回归

补齐/扩展 table-driven 集成测试，逐项覆盖读取、编辑、Done 回退；至少包括 Viewer 写拒绝、Editor 回退拒绝、Owner 回退通过、非成员猜测 ID、替换 project path、body 伪造 `role=owner`，并断言拒绝后状态未变化。最后证明 missing 和 invisible 使用同一外部响应。

提示：把“身份、project/task 关系、HTTP 动作、payload、期望 status、后续状态”作为测试行数据；从完整 Router 发请求，不只直接调用 `permits` helper。
