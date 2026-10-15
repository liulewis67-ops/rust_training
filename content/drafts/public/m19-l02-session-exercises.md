# M19-L02：Session、Cookie、CSRF 与登出三道短练习

## 预测：认证升级和注销的结果

测试契约包含一个匿名 session ID 与已认证 session。预测以下情况：成功登录时浏览器收到什么 cookie，旧 ID 是否还能查询；登出 POST 缺 token、token 错误、token 正确分别怎样；token 放在 cookie 而未放 CSRF header 是否够；GET 登出是否能改变状态。

提示：分开追踪浏览器 cookie 与服务端 session store；CSRF token 比较要绑定当前 session。

## 修复：轮换登录态并加固 Cookie

公开 starter 登录成功后会原样复用匿名 session ID，并只设置 Path。修复为登录升级后撤销旧 ID、使用 provider 给的新不透明 ID，给 session cookie 设置 `Secure`、`HttpOnly`、`SameSite=Lax`、`Path=/`，不设置 `Domain`。契约由完整 Router 测试检查旧 ID 失效、新 ID 可用和 `__Host-` 属性。

提示：身份仍从可信 `VerifiedIdentity` adapter 来；不要让 client 自选 session ID，也不要在题目中编写 CSPRNG 或密码验证。

## 实现：加入 CSRF 保护的登出

完成 `POST /api/v1/session/logout`：读取有效 session；比较 `x-csrf-token` 与该 session 的服务端 CSRF token；只在通过后撤销服务端记录，并删除匹配的 session cookie。missing/wrong/cookie-only token 必须拒绝且保持会话仍有效；GET 登出不得改状态。

提示：先检验身份和 token，再 mutate store；撤销后返回带同 cookie 名称和 Path 的过期 CookieJar。即使返回清除 cookie，也要确认后续请求使用旧 ID 得到 401。
