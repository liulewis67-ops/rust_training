# M17-L03：Tower Layer 与追踪短练习

## 预测：两层包装的 request/response 顺序

给出先添加 inner、后添加 outer 的 Router.layer 链，写出两个 middleware 与 handler 的完整事件顺序，并解释 response 回程为何反向。

提示：把新 layer 画成包裹当前 Router 的最外层。

## 修复：校正错误的 layer 顺序

修改起始 crate，让 outer 在 request 侧先执行、在 response 侧最后执行；保留 route 和 response 契约。

提示：确定每次 .layer 调用后的最外层是谁。

## 实现：完整 Router 的事件追踪验证

从公开 Router 发出一次请求，断言完整五步事件序列、200 response，且伪造的 Authorization/body secret 不进入事件记录。

提示：使用确定性 EventLog；不要用真实 tracing subscriber 的时间戳文本来猜 middleware 次序。
