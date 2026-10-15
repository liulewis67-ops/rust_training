# M17-L06 独立检查：提取器与 middleware 的短路交互

## 检查目标

在陌生的 Label API 上修复请求追踪和认证中间件的组合问题。认证失败必须仍带 X-Request-ID 和最终 status trace；合法请求通过 extractor 到 handler；JSON 格式错误由 Json extractor 返回 400，并保留 request context。修复后要用实际事件记录解释执行顺序。

## 独立答题规则

- 使用新情境，不查看本节私有评分表、参考代码或上一次课程答案。
- 先从版本化 starter ZIP 解压到全新工作目录，记录 Cargo.lock 与 manifest 版本。
- 运行公开检查，写出原始 middleware 顺序和每条请求的预期事件。
- 修复公开失败后再提交解法；平台/本地构建故障单独记录，不记为技能失败。
- 如果查看提示或参考内容，保留训练但把结果标成辅助证据；自报或截图不能冒充平台独立成绩。

## 公开变式

1. 无 Authorization 的 request 在认证 middleware 短路为 401。是否由 request-context middleware 观察并设置 request ID？
2. 带合法 token、但 JSON body 不合法的 request 是否返回 400，同时仍有同一 request ID？
3. 合法 token 与 body 是否能到达 handler，产生 201 response？trace 是否只含 context ID 和 status，不含 token/body？

## 起始基线与修复

起始 Router 把 request tracing 放在 auth 里面。认证 middleware 先返回时不会执行内层 tracing，于是 unauthorized response 缺 ID 且没有 status event。按 Router.layer 包装语义修复顺序，使 tracing 包围 auth 和 handler；不要绕过 auth、硬编码 response header 或直接制造测试事件。

## 重置与复现

1. 将 m17-l06-layer-check-starter.zip 解压到空目录；不要复用已修改的实验工作区。
2. 核对 starter-manifest.json 中 crate 文件 SHA-256。
3. cargo test 应稳定复现 unauthorized correlation 断言失败；修复 middleware 层序后再运行全套测试。
4. 第二轮从新的 ZIP 解压位置开始，重现原失败后独立修复。提交 trace snapshot、starter 版本、manifest 和变式结果。

## 失败反馈

- 401 缺 request ID：查看 `.layer` 链谁先运行；401 提前返回时哪些 layer 尚未运行？
- 400 没有 ID：检查 Json 是否保持最后一个 FromRequest extractor，以及 response 是否仍穿过外层 context middleware。
- 事件顺序错误：从完整 Router request 观察 enter/handler/exit，不要手工向日志写期望行。
- trace 出现 secret：移除 Authorization/body 等输入字段，只保留经过校验的 request ID、stage/status。

作者侧检查稿不代表未看答案的独立学习者证据；正式 A 门槛须由 R3 受控评测记录。
