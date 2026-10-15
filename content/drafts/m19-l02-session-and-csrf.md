# M19-L02：Session、安全 Cookie、CSRF 与登出

## 学完后

- 解释浏览器只携带不透明 session ID，session 身份、权限和 CSRF 状态保存在服务端会话系统中。
- 识别认证后/权限变化时轮换 session ID 的原因，并为 cookie 设置明确的安全属性。
- 用 session-bound CSRF token 保护 cookie-authenticated 的状态变更请求；登出时同时撤销服务端 session 并清除浏览器 cookie。

## 先修

完成 M19-L01，区分可信身份与资源授权；理解 Axum Router、request extension 和 HTTP 请求方法。本文使用 Axum Extra `CookieJar` 展示由受维护的 cookie API 处理 Cookie 读写。认证 credential 校验、随机 session ID 与 CSRF secret 的生成必须交给已维护的身份/session provider 或经过审核的库，不在课程中自创协议。作者侧测试使用固定的 deterministic fixture，不代表生产安全实现。

## Session cookie 只携带不透明引用

基于 cookie 的 session 中，浏览器提交一个 session ID；user ID、角色、过期时间和撤销状态由服务端 session store 持有。ID 不应编码 user ID、email、role 等业务声明。应使用受维护 provider 产生不可预测的 opaque session ID，并在服务端检查有效期、更新和撤销，不从 URL 查询参数或表单字段读取 session ID。

认证成功会把匿名请求提升为已认证 session。必须让 provider 轮换 ID，并销毁旧 ID；直接把匿名 session 的权限改为已认证会保留攻击者预先固定到浏览器的 session，导致 session fixation 风险。密码验证和 OIDC 回调不在这段教学模拟中重做。

## Cookie 属性与适用边界

```rust
let mut cookie = Cookie::new("__Host-session", opaque_session_id);
cookie.set_path("/");
cookie.set_secure(true);
cookie.set_http_only(true);
cookie.set_same_site(SameSite::Lax);
let updated_jar = jar.add(cookie);
// 将 updated_jar 作为 response parts 返回，Set-Cookie 才会写入响应。
```

`Secure` 限制浏览器仅经安全通道发送 cookie；`HttpOnly` 阻止页面脚本直接读取 session cookie，但不能阻止 XSS 代表用户发请求；`SameSite=Lax` 可减少部分跨站 cookie 携带，仍不是通用 CSRF token。`__Host-` 前缀要求 Secure、`Path=/` 且不设置 Domain，减少子域 cookie 覆盖风险。部署还须全程 TLS。不同产品需按回调和跨站流程核对 SameSite 策略，不能机械照搬单个示例。

## Cookie-authenticated 的变更请求需要 CSRF 防护

浏览器可能自动附带目标站点 cookie。攻击站若诱导浏览器向另一个站点提交变更请求，就可能借用受害者已登录 session。使用 synchronizer-token pattern 时，server 将每个有效 session 的 CSRF token 保存在 session state，经同源页面响应给 client，再通过自定义 header 或表单字段回传。服务器对当前 session 比较 token；缺失或不匹配就拒绝请求。token 由安全 provider 生成，要不可预测、按 session 绑定，不放 URL、普通日志或 session cookie 中。

`Origin`/`Referer` 比较可以作为额外信号；SameSite 也是纵深防御层。不能只靠 cookie 属性就省略适用的 token/Origin 校验。GET、HEAD 等安全方法不得改变 session、账户或业务状态；登出使用受 CSRF 保护的 POST。

## 登出要做两件事

1. 验证当前 session 和本次变更请求的 CSRF proof。
2. 先让 session provider 在 server-side 撤销 session，再返回与原 cookie 名称和 Path 匹配的过期 `Set-Cookie`。

只清除浏览器 cookie 不会使攻击者已复制的 session ID 失效。反过来，只撤销服务端也会让当前浏览器继续发送无效 cookie，增加噪声。错误响应使用稳定 code，不回显 session ID 或 CSRF token；日志也不能记录原始 token。

## 本课的可验证模拟范围

公开 starter 为 session adapter 提供固定的匿名和登录态 fixture ID，为 CSRF store 提供固定 token，从而能重复验证 ID 轮换、cookie 属性、header 校验、服务端撤销和浏览器清除。固定值只用于 test harness。真实登录、CSPRNG、cookie 浏览器策略、CSRF 库、中间件并发行为及持久 session store 必须由目标 provider、浏览器和隔离部署环境单独验收。

## 分层提示

1. **数据边界提示**：cookie 保存的是 user_id/role 还是 provider 产生的不透明 session ID？业务 session 状态应由哪一端持有？
2. **固定攻击提示**：若登录后仍沿用匿名 ID，攻击者能否在登录前设定受害者随后使用的 ID？认证升级后应发生哪两件事？
3. **Cookie 提示**：Secure、HttpOnly、SameSite 分别约束什么？哪项不等于 CSRF token 校验？
4. **CSRF 提示**：为什么浏览器自动附带 Cookie，不能证明请求是用户从可信页面发起的？token 应从哪里回到 server？
5. **登出提示**：删除浏览器 cookie 后，已被复制的 ID 还能不能使用？server revoke 和 Set-Cookie expiration 各解决什么？
6. **方法提示**：为什么 `GET /logout` 会破坏安全方法假设和缓存/预取行为？
7. **验证提示**：如何证明缺失/伪造 token 不撤销 session，正确 token 才同时撤销服务端会话并过期 cookie？

## 来源

- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)：opaque ID、TLS、cookie 属性、认证后轮换、服务端过期和登出撤销。
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)：session-bound synchronizer token、Origin/Referer 与 SameSite 的纵深防御边界。
- [Axum Extra 0.12.6 `CookieJar`](https://docs.rs/axum-extra/0.12.6/axum_extra/extract/cookie/struct.CookieJar.html)：解析请求 cookie、添加/删除 cookie，并在响应中返回更新后的 jar。
- [RFC 6265](https://www.rfc-editor.org/rfc/rfc6265.html)：HTTP Cookie 与 Set-Cookie 的基础状态管理规范。SameSite 和 `__Host-` 还需结合当前浏览器与更新的 cookie 标准核验。

Security recommendations按 OWASP 文档核对；cookie API 按固定 Axum Extra 版本核对。固定测试值和 session adapter 均为原创教学 fixture，不是可部署的登录/session 系统。
