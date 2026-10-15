# M20-L02：三道短练习

本组练习用一个固定 API 合同：单次 deadline 300 ms、最大 4 次 attempt（含首请求）、总操作 deadline 2 s、base delay 100 ms、max delay 800 ms。full jitter 输入可预测，`Retry-After` 是最短等待时间；若等待会越过总 deadline，则停止。所有写入沿用 M20-L01 的同一幂等键。

## 1. 预测：失败分类与截止时间

对每个场景预测是否继续、等待如何计算、底层最多收到多少次请求：

1. GET 收到一次网络 reset、再收到 200；第一重试指数上限 100 ms，固定 jitter 采样为 60 ms。
2. POST 创建任务后响应 timeout；相同 key 再试一次，服务端重放原 task。
3. POST 发生 timeout 后客户端生成新 key 重试。
4. GET 返回 400 校验错误；GET 返回 429 `Retry-After: 2`，此时总 deadline 只剩 1 秒。

**提示**：次数是 attempts，包含首请求；2 秒以上 Retry-After 不是让客户端违反总预算去等待，也不是允许 1 秒后提前重试。

**验证合同**：场景1 最多再发一次且等待 60 ms；场景2 安全重放而副作用只发生一次；场景3 因 key 改变不能证明安全；场景4 的 400 停止，429 因无法在预算内满足建议而停止。

## 2. 修复：无差别立即重试

**错误策略**：

```text
loop:
    response = call(request)
    if response is error:
        continue immediately
```

**契约**：按上方固定 API 合同修复策略。不得重试永久请求错误、权限错误或冲突；副作用写入只有幂等键不变时可重试；暂时错误使用有界指数退避和 jitter；执行前尊重 attempt 与 total deadline。

**提示**：分别设计 `RetrySafety`、`FailureClass`、`RetryBudget`，避免一个布尔值同时混淆错误分类、业务副作用和剩余时间。

**验证合同**：非法输入/403/409 不再次调用；幂等 POST 在 timeout 可用相同 key 重试；attempt 不超过 4；退避不超过 800 ms；sleep 不突破总 deadline；延迟计算溢出时安全封顶。

## 3. 实现：带 Retry-After 的延迟选择

实现或说明纯函数 `next_delay(retry_index, sample, retry_after, remaining_budget)`。`sample` 是 `[0, cap_n]` 内的确定性 jitter 采样，供单元测试使用。

**契约**：指数上限 `cap_n = min(800 ms, 100 ms × 2^retry_index)`；基础等待为 `sample`；带服务端建议时等待不得短于该建议；若最终等待大于剩余预算，则返回停止而非提前发送；处理大 index 与时间溢出不 panic。

**提示**：把“等待值”和“是否仍能在 deadline 内进行下一次 attempt”分别算清。真实随机 jitter 由外层延迟源注入，函数自身便于确定性测试。

**验证合同**：index 0 / sample 60 ms / no header 得 60 ms；index 3 cap 为 800 ms；Retry-After 2 s 且剩余 1 s 返回停止；Retry-After 300 ms、sample 40 ms、剩余 500 ms 得 300 ms；非法/负/溢出的 server delay 按公开解析策略失败关闭且不提前重试。
