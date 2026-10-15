# M19-L01：认证与授权三道短练习

## 预测：已认证是否代表可以读取

场景：request 没有可信 `Principal`；request 带 `Principal(user_id=7)` 且记录 owner 为 7；request 带 `Principal(user_id=12)` 且记录 owner 为 7。根据本课 API 契约，分别预测 HTTP 状态和身份/权限判定步骤。

提示：先问凭据是否被可信边界验证，再问此 principal 是否能对目标 record 执行 read。不要根据资源 ID 猜 caller。

## 修复：补齐 object-level authorization

公开 starter 的 `GET /api/v1/records/{record_id}` 只检查 principal 存在，已登录的 user 12 因而能读取 user 7 的记录。修复 server-side policy，使匿名仍是 401、owner 仍是 200、非 owner 返回契约规定的 403。

提示：handler 收到的 `Principal` 来自测试 adapter 注入的可信 extension；比较它和本次加载出的 resource owner。不要从请求中接受新的 caller ID。

## 实现：保护导出动作

增加 `GET /api/v1/records/{record_id}/export`。owner 可读取导出视图；匿名请求为 401；已登录但不是 owner 返回 403。export handler 必须使用同一可信身份边界并对目标记录重新授权，不能假设前一个页面或普通 read route 已经授权。

提示：通过完整 Router 发请求。覆盖 owner 与非 owner；测试 body/query 中伪造的 `user_id` 不得把非 owner 变成 owner。
