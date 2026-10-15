# M24-L03 三道短练习

## 预测：评审未测试的权限变更

一个 PR 把 `project_id` 从 URL 路径挪到 query，并更换了授权 crate，但只新增了一条 happy-path 测试。列出可能的回归风险，写一条具体、可操作的 review finding，并给出最小回归场景及修复前/后的验证证据。

**合同：**评论包含位置、可观察行为、预期合同、复现输入、风险和建议；覆盖跨项目访问或无权限行为；不把个人格式偏好当 blocking finding。

**提示：**先确定主体、项目归属和返回差异，再说明如何验证隔离没有回退。

## 修复：拒绝不可行动的 review finding

starter 的 `validate_finding` 漏掉影响说明和回归证据检查。补齐标题/位置、当前行为、预期合同、复现步骤、风险和证据 ID 的非空校验，按 enum 声明顺序稳定返回第一项错误。

**公开检查：**每个字段的空白输入被拒绝；完整发现通过；不发明代码位置或测试证据。

**提示：**稳定错误次序让同一条不完整评论每次给出一致反馈。

## 测试补全：升级的兼容矩阵

为 `missing_compatibility_checks` 补充测试：必要检查包括 old client/new service、new client/old service、old data/new code、rollback/data compatibility。覆盖完整矩阵、各单项缺失和未知扩展；输出要按合同顺序。

**公开检查：**空集合报告全部缺项；完整集合无缺项；输入排序不改变报告顺序；未知扩展被忽略。

**提示：**测试应验证用户风险边界，不要只检查一个 crate version 字符串。
