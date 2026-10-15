# M20-L02：超时、重试和退避

## 学完后

- 区分可重试的暂时故障、需按服务端指示等待的限流/过载，以及不会因原样重试而修复的永久错误。
- 为每个请求配置有限尝试次数、单次超时和总操作截止时间。
- 使用有上限的指数退避与随机抖动；仅在操作幂等或由幂等键保护时重试副作用请求。

## 先修

完成 M20-L01，理解幂等键的范围、指纹和重复提交。理解 Rust `Result`、HTTP 状态码和超时。重试是对一次逻辑操作的有限调度策略，不是遇到 `Err` 就再次调用同一个函数。

## Timeout 是不确定结果

请求超时只说明调用方在预算内没有收到结果。服务端可能尚未收到请求，也可能已经提交数据库写入，只是响应在网络中丢失。取消本地 future 不会自动回滚远端副作用。因此创建订单、任务、扣款或发送消息后发生 timeout 时，盲目使用新请求再做一次可能造成重复；只有幂等操作，或使用第一次请求的同一个幂等键，才可安全重试。

调用超时应拆成几个预算：每次尝试的 deadline、最多尝试数和整个用户操作的 deadline。单次 timeout 过短会把正常慢请求误判为失败；过长则占用连接、任务和上游请求槽位。总 deadline 到期后即使还剩 retry 次数也要停止，并把“结果未知”与“确定未执行”区分给调用方。

## 按失败类别作决定

| 类别 | 默认动作 | 理由 |
|---|---|---|
| 输入错误、schema 校验、权限拒绝 | 不自动重试 | 原请求不变时通常不会成功；先由调用方改正输入或凭据 |
| 资源不存在、幂等键冲突、revision 冲突 | 不原样重试 | 需要改变资源/输入或重新读取后由业务流程决策 |
| 连接短暂中断、服务端 502/503/504、可恢复的依赖故障 | 仅当操作安全时有限重试 | 服务可能暂时恢复，但故障也可能持续或是过载信号 |
| 429 限流、带 `Retry-After` 的服务端响应 | 按服务契约等待，不能早于服务端建议；再受本地总 deadline 限制 | 继续抢发会加剧限流和过载 |
| timeout | 只对幂等读或有幂等保障的写入有限重试 | timeout 不揭示远端是否已完成副作用 |

HTTP `Retry-After` 可用秒数或 HTTP-date 表示服务器建议的等待时间；对 503，RFC 9110 说它表示预计不可用时间；429 的重试时间行为要结合 RFC 6585 和 API 自己发布的策略。客户端应拒绝负数/非法日期，避免溢出，并受总截止时间约束。不要把 `Retry-After` 缺失解释为可以无限快速重试。

## 有界退避和抖动

对第 `n` 次重试计算退避上限：

```text
cap_n = min(max_delay, base_delay × 2^n)
delay = random(0, cap_n)  // full jitter
```

随机抖动把大量同一时刻失败的客户端分散开，避免它们整齐地同时重试。`base_delay`、`max_delay`、最大尝试数和整体 deadline 都必须是显式配置；计算要防止指数/时间单位溢出。若服务器给出了 `Retry-After`，等待不能短于该建议，但超过剩余 deadline 时就停止，而不是截短后提前重试。

在重试前重新检查取消信号和剩余 deadline。为每个逻辑操作设置 retry budget，避免 client、API 和数据库层各自重试导致尝试数相乘。对已经在排队或接近过载的下游，快速失败往往比增加流量更安全。重试日志记录 attempt、类别和剩余预算，不记录认证凭据、敏感 body 或原始幂等键。

## 可运行代码里的策略边界

公开示例可用确定性的 jitter 输入验证时序表，不依赖真实 sleep、随机数或网络。生产中随机源用于分散客户端，不同测试要固定 seed 或注入 delay source。选择何种 HTTP/数据库错误可重试属于调用 API 的策略，不应把所有 `std::io::Error` 或所有 5xx 一概判断为安全。

```rust
let started = Instant::now();
for attempt in 0..policy.max_attempts {
    let remaining = policy.total_deadline.saturating_sub(started.elapsed());
    if remaining.is_zero() { break; }
    match call_with_timeout(request.clone(), policy.per_attempt.min(remaining)).await {
        Ok(response) => return Ok(response),
        Err(error) if !policy.is_retry_safe(&error, operation) => return Err(error),
        Err(error) if attempt + 1 == policy.max_attempts => return Err(error),
        Err(error) => sleep(policy.next_delay(attempt, error.retry_after(), remaining)).await,
    }
}
```

示例表达策略顺序，省略了具体 error 类型、`Instant` 溢出和异步取消细节；不要把它复制成完整生产 client。写请求在重试时必须保留相同幂等键。重试返回最后一次错误时应保留可诊断的类别，不掩盖第一次请求结果未知这一事实。

## 分层提示

1. **超时提示**：客户端超时后，你能否断定服务端没有写入？为什么？
2. **分类提示**：把输入验证失败、403、429、503、网络中断和同键异参 409 分别放进“停止、遵从建议等待、有限退避”哪一类？
3. **预算提示**：3 次 attempt 是否等于 3 次 retry？哪个值包含首请求？总 deadline 如何限制 sleep？
4. **抖动提示**：所有客户端按固定 1 秒重试会怎样同步？jitter 把哪些量随机化？
5. **Retry-After 提示**：服务器建议等待 10 秒而本地只剩 4 秒时，应该等 4 秒后提前重试吗？
6. **副作用提示**：POST timeout 后若使用新幂等键重试，M20-L01 的哪个保证被绕过？
7. **分层重试提示**：三层各做 3 次 retry（各 4 次 attempt）时，最底层最多收到几次调用？

## 来源

- [RFC 9110 §10.2.3 Retry-After](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3)：Retry-After 的秒数/日期语法及其与 503 的含义。
- [RFC 6585 §4 429 Too Many Requests](https://www.rfc-editor.org/rfc/rfc6585.html#section-4)：限流状态及相关响应语义。
- [Google SRE Book：Addressing Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/)：随机指数退避、retry limit、retry budget、避免多层重试放大和 deadline。
- [AWS Builders' Library：Timeouts, retries, and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)：副作用使重试不安全、deadline、backoff 与 jitter 的工程经验。

具体错误分类、attempt 数和最大等待属于本课程原创服务策略。真实服务需依赖其 API contract、业务幂等性及过载策略配置；本机确定性模拟不代替 R3 故障注入或线上容量验证。
