# M19-L06：独立检查——项目任务导出的授权回归

## 独立作答

这是 M19 最后一节的独立检查，不是第 13 道短练习，也不重复 M19-L05 单任务读写实验。完成 M19-L05 后再作答。首次提交前只阅读本题和公开起始工作区；不要查看 M19-L05 参考实现、本题 private assessment 或教师答案。允许使用分层提示。看过参考答案后可以继续练习，但这一提交不记作独立能力证据。

## 陌生变式

新接口允许项目 Owner 和 Editor 导出任务列表。项目 Viewer 可读取单个任务，但不能导出整个列表。匿名 caller、没有该项目 membership 的用户和不存在的项目不能得到导出数据。导出结果只包含服务端归属到 URL `project_id` 的任务；两个项目即使有相同类型的数据，也不能因收集查询漏条件而混在一份导出中。

起始工作区已经有可信的 `VerifiedIdentity` 测试 adapter、Owner/Editor/Viewer 角色和 Router 请求。handler 先做 action 权限检查，却存在 collection query scope 缺陷。请完成 `tests/public_contract.rs` 中的独立回归用例，再修复实现。不要删除或削弱现有正向测试来使检查变绿。

## 要交付的证据

1. 一条新的完整 Router 测试：用有权限导出的用户访问自己的项目，断言响应没有包含其他项目的 task。测试必须在原始错误实现上失败，在修复后通过。
2. 修复后的安全实现：Owner/Editor 对自己项目导出成功；任务集合都属于 path project；Viewer、outsider、匿名和未知项目按固定拒绝契约处理。
3. 重跑的独立检查结果、源文件和测试文件 SHA-256、starter/评测版本及 attempt label。提交内容必须来自起始快照；被删掉的测试不算修复。
4. 一句说明解释你的回归断言为什么能发现授权绕过，而“状态码是 200”为什么不足以证明范围正确。

## 可见评分与技能证据

总分 100：回归测试质量 25；数据 scope 修复与项目间隔离 35；角色与拒绝契约 20；授权 Editor/Owner 正常操作保持 10；提交快照与说明 10。跨项目数据泄露或 Viewer 导出属于关键失败，即使总分达到 85 也不通过。通过要求总分至少 85、无关键失败，并由隐藏变式证明正常允许操作仍有效。

反馈使用固定类别：`REGRESSION_TEST_MISSING`、`FOREIGN_PROJECT_ROW`、`VIEWER_EXPORT`、`ALLOWED_EXPORT_REGRESSED`、`SNAPSHOT_INVALID`。反馈给出失败分类、相关请求组合和预期/实际结果，不展示其他用户的数据样本或隐藏输入。未通过可看提示、查看答案后在练习模式重试；答案已查看的 attempt 不写独立技能证据。

技能证据包含 assessment/course 版本、attempt label、提交源/测试哈希、起始 manifest 哈希、测试包版本、独立性标志、结果及平台运行状态。只有首次独立且通过的证据才更新 `security.authorization.object-scope`。学习者答案失败可供练习，不自动降低已有等级；编译服务、评测 worker 或课程平台故障只记录为 `platform_error` 并允许重试，不生成失败技能结果，也不降低等级。

## 分层提示

1. **数据来源**：谁决定 task 属于哪个 project？导出应该根据 URL、task 行、还是请求 body 的什么关系过滤？
2. **测试设计**：先建立一个自己项目有导出权限的用户，再在另一个项目放置敏感 canary row；怎样让断言在旧代码失败？
3. **保留正向能力**：修复 collection 查询后，哪条断言能证明合法 Editor 仍能导出完整的本项目列表？
4. **评测设计**：为什么 hidden test 要换掉公开 task ID 和用户组合？为什么首次测试失败不应该扣除已有技能等级？
5. **检查快照**：如何证明提交没有删除回归测试或替换起始评测契约？

## 来源

- [OWASP Authorization Testing Automation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Testing_Automation_Cheat_Sheet.html)：将角色、服务与测试载荷组合成集成授权矩阵。
- [OWASP Authorization Regression Testing Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Regression_Testing_Cheat_Sheet.html)：使用结构化矩阵覆盖横向越权、租户边界并纳入持续回归。
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)：访问控制集成测试可以减少授权缺陷，但不替代专业安全测试。

项目角色、任务列表和评分权重为原创练习约定。该 Windows/in-memory author package 只验证本题评测行为，不替代正式 R3、生产数据库隔离或人工安全评估。
