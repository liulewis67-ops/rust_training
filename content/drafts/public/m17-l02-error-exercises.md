# M17-L02：业务错误与服务错误短练习

## 预测：错误分类与恢复动作

分别预测无效用户 ID、有效 ID 但资源不存在、依赖连接池离线和 handler bug 的服务边界处理。标明哪个错误可让 client 修请求，哪个需要重试或运维排查。

提示：底层存储知道依赖为何失败；HTTP handler 负责将失败翻译成应用承诺的 status/code。

## 修复：隐藏 store 的敏感诊断

修复 `StoreUnavailable` response，不再把 source 字符串直接放入 JSON message；保持 503 + `service_unavailable` 稳定 code，并保留内部诊断记录。

提示：分别观察 tracing/logging 与 HTTP body；两处输出不需要同一详细度。

## 实现：完整 error mapping 测试

补齐合法用户、missing user、无效 id 和 injected store failure 的 Router tests。验证 200/404/400/503 与各自错误 code，并确认 503 body 不含连接 URL/host/credential。

提示：用确定性故障注入，不依赖真实数据库断线或随机 timeout。
