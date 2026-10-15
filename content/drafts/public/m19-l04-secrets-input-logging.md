# M19-L04：密钥、密码哈希、输入和日志边界

## 学完后

- 从配置来源读取运行时秘密，并保证 Debug、错误和结构化日志不会带出秘密值。
- 使用经过维护的 Argon2id 实现与每个密码独立生成的随机 salt；不自创密码协议或用 SHA-256 直接存密码。
- 在昂贵密码运算之前同时限制 UTF-8 字节数和 Unicode 字符数，并在 HTTP 边界限制请求体。
- 设计能调查认证异常、但不收集密码、token、邮件正文、哈希串或 SMTP 凭证的 allow-list 日志事件。

## 先修和边界

先完成 M19-L03 的项目资源角色授权。该课讲的是认证系统中的凭据与输入边界，不实现账户注册、登录、Session、重置邮件，也不把课程 fixture 当作生产身份服务。公共 starter 中的 `/api/v1/password/check-input` 仅用于观察输入策略和 body limit，不验证账号，也不接受任何生产身份。

## 密钥是运行时数据

不要把 SMTP 密码、签名密钥、数据库 URL、访问 token 放进源码、示例配置、截图、错误文本或课程提交历史。运行进程应从受控环境配置/密钥管理来源取值；部署环境要限定谁能读取、支持轮换，并避免将整个配置结构直接 Debug。将值包在 `SecretValue` 这样的新类型中只能减少意外格式化，不能替代安全存储或访问控制。

错误可以指出哪个配置键缺失，例如 `required secret SMTP_PASSWORD is missing`，但不能包含键的值。秘密只应在明确授权的调用点通过窄接口短暂暴露。若发现秘密进入日志或仓库，要按真实凭据泄露处理并轮换；删掉一条日志或补一个 ignore 规则不能撤销已复制的秘密。

## 密码需要慢哈希

密码用于验证，不应加密后可逆存储，也不能明文存储。使用成熟、维护中的密码哈希库，让它生成 salt 并编码标准 PHC 表示；本课 Rust 参考解使用 Argon2id。OWASP 给出的最低建议配置是 19 MiB 内存、2 次迭代和并行度 1。部署前仍需在目标机器上测量认证延迟和并发内存占用；参数是可升级的，不应绕过库 API 自己拼接字符串。

注册和改密时先检查输入，再算哈希；验证时从存储值解析 PHC 编码并调用库的验证接口。每个密码必须使用不同的随机 salt，所以相同密码通常得到不同 PHC 字符串。该 PHC 字符串是验证所需的受保护凭据材料：不要返回给客户端、写日志、加入错误或在调试输出中打印。SHA-256 速度快，适合某些摘要场景，但不能作为密码存储方案。

## 同时限制字符、字节和请求体

本课程的产品练习契约限定密码为 12–128 个 Unicode scalar values，UTF-8 编码最多 512 bytes。字符数用于说明可读长度，字节上限则防止超长输入在解析、复制或哈希前消耗不受控资源。Rust `str::len()` 计算字节数，`chars().count()` 计算 Unicode scalar values；两者不是同一个单位，也不是用户眼中的字素簇计数。

先在业务入口检查这两个界限，然后再调用 Argon2。HTTP 路由还要限制原始 body，避免 JSON extractor 为超大文档分配大量内存。Axum `DefaultBodyLimit` 适用于会使用其 limited-body extractor 的类型（例如 Json）；如果自定义 extractor 直接流式读取 body，或有第三方 extractor，则要确认限制确实覆盖它，必要时在 Tower HTTP 层增加全请求限制。不要为了“读取完整输入”而关闭对不可信请求的限制。

## 日志采用字段白名单

安全日志仍需留下可调查事件，例如固定事件名、路由模板、结果类别、状态码、时间、request/correlation ID 和经过策略处理的主体标识。不要把请求体、headers、Cookie、Authorization、密码、session/token、哈希、邮件正文、连接串或 secret wrapper 直接 `Debug`。尽量让日志调用点只接收允许的字段；在日志采集层再做过滤是第二道保护，不是主要边界。

错误消息同样是输出通道：不要把密码或 secret 放进格式化错误、panic 文本、HTTP response、metrics label 或 tracing span。返回固定、可操作的类别；内部错误可以保留非敏感操作上下文，但仍需检查依赖库错误是否会带入输入。拒绝事件可记 outcome 和受控的主体标识，不必记录失败密码或完整 token。

## 示例：验证存储密码

```rust
let salt = SaltString::generate(&mut OsRng);
let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, reviewed_params);
let phc = argon2.hash_password(password.as_bytes(), &salt)?.to_string();

let parsed = PasswordHash::new(&phc)?;
argon2.verify_password(candidate.as_bytes(), &parsed)?;
```

这是密码验证 API 的形状示意；生产系统还要有账户状态、速率限制、统一外部错误、重置和审计策略。不能把此片段抄成自制认证系统。课程参考实现使用 argon2 crate 的 PHC 接口，并对哈希包装类型 Debug 脱敏。

## 三道短练习

1. **修复**：公开 starter 将密码以明文包装保存、派生 Debug 会输出内容，而且 tracing 直接记录请求密码。改用 Argon2id PHC hash 和独立 salt，比较时使用 verifier，输出安全日志 allow-list；验证错误密码不能通过。
2. **实现**：补齐 12–128 字符和 512 字节策略、不会泄露内容的 `SecretValue`/缺失配置错误，以及请求体大小上限。覆盖多字节 Unicode、超长 body 和 secret sentinel。
3. **设计评审**：检查评审卡中的“debug 整个 config、SHA-256(password)、不限制 JSON body、日志输出 Cookie/header 与 error 字符串”的处理链，标出泄露点和资源耗尽点，并提出按顺序可验收的修正。

## 分层提示

1. `str::len()` 和 `chars().count()` 分别测量什么？多字节输入会暴露哪一个没覆盖的上限？
2. 先拒绝非法输入，再哈希的顺序有什么资源安全收益？body limit 与密码字段 limit 是否重复？
3. 哪个成熟库接口能生成随机盐、PHC 串和验证结果？如何确认它选择的是 Argon2id 与已审核参数？
4. `Debug`、错误链和 tracing span 能否格式化敏感值？用唯一 sentinel 怎样检出意外输出？
5. 如果日志必须记录认证失败，最少保留哪些 allow-list 字段足以分类，而不记录 password/token？
6. `DefaultBodyLimit` 由哪些 Axum extractor 执行？直接流式读 body 时还需要确认什么？
7. 正确方案和常见错误解分别应观察什么？覆盖多字节长度、错误密码、不同 salt、超大 body 和敏感 sentinel。

## 来源

- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)：Argon2id 参数最低建议、随机 salt、避免明文和快速通用 hash。
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)：秘密生命周期、最小可见性、轮换和禁止在日志中暴露。
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)：密码、访问 token、session ID、连接串和主密钥应从直接日志中排除。
- [RustCrypto argon2 0.5.3 文档](https://docs.rs/argon2/0.5.3/argon2/)：所用 Rust crate 的 PHC 密码哈希和验证 API。
- [Axum 0.8.9 DefaultBodyLimit 文档](https://docs.rs/axum/0.8.9/axum/extract/struct.DefaultBodyLimit.html)：默认请求体限制的 extractor 范围与设置方法。

12–128 字符和 512 字节是本课程/项目练习契约，不声称是通用标准。作者侧 in-memory 和 HTTP fixture 不代表生产密钥管理、账户系统、抗滥用或正式 R3 验收。
