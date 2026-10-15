# M19-L04：密钥、密码哈希、输入和日志边界三道短练习

## 修复：从明文存储改为审核密码哈希

Starter 的 `StoredPassword` 用明文保存用户密码、`Debug` 可显示底层值，handler 还把 password 写进 tracing。修复后要求 Argon2id PHC 哈希、每次创建独立随机 salt、正确调用密码 verifier；包装值 Debug 需脱敏，日志只能包含固定 event 和验证结果字段。

验证：正确候选通过，错误候选失败；PHC 标识为 Argon2id；同一密码创建两次哈希不同；sentinel 不出现在 Debug、错误、响应或日志字段中。

提示：不要用 SHA-256、固定 salt 或自己比较哈希字符串。检查 argon2 crate 提供的 `PasswordHasher` 和 `PasswordVerifier`。

## 实现：密码和请求体的两道输入上限

实现 12–128 Unicode scalar values、512 UTF-8 bytes 的密码契约；边界检查必须发生在昂贵哈希前。为 `SecretValue` 实现红acted Debug，并实现一个只报告配置项名称的缺失 secret 错误。将 Axum Json 路由的请求体限制到 1024 bytes。

验证：拒绝 11 和 129 字符、拒绝超过 512 字节的多字节输入、接受 12 和 128 字符；完整 Router 测试超过 1024 bytes 得到 413，合法请求得到 200。注意 body cap 与字段 cap 覆盖不同层。

提示：Rust `str::len()` 是 UTF-8 bytes，`.chars().count()` 是 Unicode scalar values。先比较两种上限，再调用哈希库。

## 设计评审：找出秘密与未设限输入的传播链

评审卡：启动时 `tracing::debug!(?config)`；请求处理中 `tracing::warn!(headers = ?headers, body = %body)`；密码落库为 `sha256(password)`；JSON extractor 前没有 body cap；遇错时 `format!("bad password {password}: {error}")` 返回客户端。列出泄露和资源风险，说明修复顺序，并给每项一个可自动验证的回归条件。

验证：答案至少识别配置/headers/body/error 中的秘密回显、快速通用摘要不适用于密码、未经限制的 body 解析/拷贝成本，并提出 secret 来源限制、Argon2id、字段白名单日志、固定外部错误、body 与字段双重界限。

提示：分别追踪数据进入 source/config、extractor、业务验证、日志/error、持久化及 response 的流向；密钥专用 wrapper 不能挽回已经写入 logs 的秘密。
