# M19-L01：认证与授权

## 学完后

- 说清认证回答“调用者是谁”，授权回答“这个调用者能否对这个资源执行这个动作”。
- 只从经过可信认证边界验证的身份上下文读取 caller，不把 body、query、path 或普通 header 中的 user ID 当成已认证身份。
- 对每个受保护的资源操作执行授权；已认证但没有权限时仍拒绝请求。

## 先修

建议完成 M17 和 M18，理解 Axum `State`/`Extension`、HTTP 错误映射和资源持久化。I10-F03 是实施台账中的正式前置；作者包目前只有作者侧预写，正式完成仍为 TODO。本文是可以先行编写的无数据库课程稿，登录、session cookie、CSRF、角色矩阵和真实数据库验收分别由后续单元处理。

## 两个问题，两个责任

**认证（authentication）**验证某个凭据或 session 是否代表一个调用者，并从受信任的身份提供方得到稳定的 caller identity。**授权（authorization）**结合 caller、目标资源和本次动作，判断该请求是否允许。一个请求可以认证成功但授权失败：例如 user 12 有效登录，却试图读取归 user 7 所有的私有记录。

```text
请求凭据 ──认证边界验证──> Principal(user_id = 12)
                                  │
请求中的 record_id ──────────────┤
请求动作 read ──────────────────┤──授权策略──> allow / deny
                                  │
记录的 owner_id = 7 ────────────┘
```

认证适配器负责检查凭据并创建可信 `Principal`；资源层负责检查该 principal 对目标记录是否有权限。不能把“已经有 `Principal`”当作任意资源操作都通过授权。反过来，授权函数也不能自行信任客户端传来的 `user_id` 或 `is_admin` 字段。

## caller 身份必须来自可信边界

在 Axum 应用中，认证 middleware 或提取器可在验证 session/token 后，将 `Principal` 放入 request extensions；后续 handler 用 `Extension<Principal>` 提取此类型，不重新解析客户端 JSON 中的 caller 字段。测试可以在进程内插入 `Principal` 来隔离授权逻辑，但这不等于课程 starter 自己完成了登录认证。

```rust
#[derive(Clone, Copy)]
struct Principal {
    user_id: u64,
}

struct PrivateRecord {
    id: u64,
    owner_id: u64,
    title: String,
}

#[derive(Debug, PartialEq, Eq)]
enum AccessError {
    Unauthenticated,
    Forbidden,
}

fn authorize_read(
    principal: Option<Principal>,
    record: &PrivateRecord,
) -> Result<(), AccessError> {
    let principal = principal.ok_or(AccessError::Unauthenticated)?;
    if principal.user_id != record.owner_id {
        return Err(AccessError::Forbidden);
    }
    Ok(())
}
```

函数先要求有效 identity，再按资源 owner 与本次 read 动作做判断。这是教学用的单一 owner policy；真实产品可有成员、角色或属性规则，但仍需保持“身份来源”和“权限决定”是两个可检查的步骤。若资源是否存在本身敏感，API 可以按明确契约对无权访问返回 404；本课固定返回 403，让学习者看清认证成功后的权限拒绝。

## HTTP 状态是边界契约

本课程样例规定：没有可信 principal 返回 401 `authentication_required`；认证成功但不是记录 owner 返回 403 `forbidden`；owner 读取返回 200。HTTP 401 用于缺失/无效的认证凭据，并应按认证方案提供适用的 `WWW-Authenticate` challenge；有效凭据不足以满足访问要求时，403 表示服务器理解请求但拒绝执行。实际 API 应与其认证方案和资源隐藏策略一致。

公开错误只给稳定 code 和安全 message，不回显 owner ID、底层 session/token 或用户是否存在等不必要细节。对同一路由的不同资源 ID 都检查权限，不能只在页面或前端隐藏链接；访问控制要发生在服务器端受保护资源附近。

## 测试两种拒绝原因

通过完整 Router 构造三种请求：匿名读取、owner 读取、另一个已登录用户读取。分别断言 401、200、403 和稳定错误 code。再向 query/body 放入另一个 user ID，确认它不能改变可信 `Principal`。这些检查证明两个边界被分开；它们不能证明真实 session cookie、OAuth provider、CSRF 或生产数据库配置正确。

## 分层提示

1. **职责提示**：验证 credentials 并得到 caller ID 属于认证还是授权？比较 caller 与记录 owner 属于哪一步？
2. **预测提示**：principal 缺失、owner principal、非 owner principal 分别得到哪种结果？说明理由。
3. **修复提示**：如果 handler 只检查 `principal.is_some()` 就读取任意 record，补上对“当前 record＋read 动作”的服务端 policy check。
4. **实现提示**：从 trusted `Principal` extension 取 caller；解析 path resource ID；验证 owner 后才构造成功 response。
5. **信任提示**：为什么不能让 body 的 `{ "user_id": 7 }` 覆盖认证上下文里的 user ID？
6. **验证提示**：如何用匿名、owner、另一个有效用户三条完整 Router 请求，证明身份通过不等于权限通过？

## 来源

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)：区分 authentication 与 authorization，建议默认拒绝并在每次请求验证权限。
- [Axum 0.8.9 `Extension`](https://docs.rs/axum/0.8.9/axum/struct.Extension.html)：说明 extension 由应用层向 handler 提供，以及缺失 extension 的处理边界。
- [RFC 9110 §15.5.2–15.5.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.2)：定义 401 与 403 的 HTTP 语义。

所有用户、资源、策略和练习为原创教学素材；术语、安全控制与 HTTP 状态按上述来源核对。作者稿不代表正式 R3、真实身份供应商或独立学习者验收。
