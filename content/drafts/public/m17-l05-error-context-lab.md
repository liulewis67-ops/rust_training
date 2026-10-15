# M17-L05 实验：统一错误与请求上下文

## 目标

为 user API 接入请求上下文 middleware：接收并验证可用的 X-Request-ID；缺失或格式不符时生成新的 ID；将 RequestContext 放入 Extension；把 ID 放到所有响应 header，并在低敏感事件记录中关联最终 HTTP status。业务 404 和模拟 service 503 保持 M17-L02 的稳定错误 code/message。

## 实验契约

| 请求 | 预期 |
|---|---|
| GET /users/42，携带有效 X-Request-ID | 200，response echo 相同 ID；handler 与 response 事件共享该 ID |
| GET /users/42，不携带 ID | 200，生成非空 ID；response header 与 status 事件一致 |
| GET /users/missing，携带 ID | 404 / not_found；response 仍带原 ID，trace 记录 404 |
| GET /users/offline，携带 ID | 503 / service_unavailable；response 仍带原 ID，message 不暴露内部诊断 |
| 任一请求包含 Authorization/body secret | ID、route 类别与 status 以外的敏感值不得进入 trace |

本地样例的生成器用单调计数值便于复现；生产系统应选择适当碰撞概率的 request-ID 生成策略，并在受信任边界处理来自上游的 ID。

## 工作流程与重置

1. 将 m17-l05-error-context-starter.zip 解压到全新目录，或从 starter crate 目录复制到空目录；不要把修改叠加回起始副本。
2. 运行 cargo test 观察基线。缺失 ID 的请求没有 response ID，也无法将 handler event 与最终 status 关联。
3. 先写出 middleware/handler/response 的上下文流向，再实现验证或生成 ID、插入 Extension、设置响应 header 和状态 trace。
4. 运行完整公开测试，再从 ZIP 重新解压到另一个空目录确认相同基线；用 starter-manifest.json 核对文件 SHA-256。
5. 记录源版本、修复前后测试结果和当前工作区快照。重置永远从干净起始 ZIP 开始。

## 已知错误变体

- 只 echo 已提供的 request ID，缺失时不生成，令失败请求无法关联。
- 只在成功 handler 设置 header，导致 404/503 没有 request ID。
- 使用未验证的上游值作为日志字段，允许换行或超长值污染日志。
- 把 Authorization、Cookie、完整 body 或 store source 复制到日志。
- 生成 ID 只写 response，不通过 Extension 交给 handler/context 记录。

## 恢复说明

如需重做，删除上一次实验副本并从 ZIP 解压到新的空目录；再次运行 cargo test 记录 starter 基线。不要从私有参考 crate 复制文件做重置。Cargo.lock 与 starter manifest 一并保留，样例源文件有变更时先更新实验版本再发新的压缩包。

本实验使用确定性本地 API，不连接数据库或容器。通过作者侧 crate 不代表平台快照、R3 或 P3 验收。
