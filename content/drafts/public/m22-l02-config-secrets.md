# M22-L02：环境配置与秘密注入

## 学完后

- 把部署间变化的配置从源码和镜像分离，区分普通配置与秘密。
- 在启动边界一次性读取并校验必需设置；缺项、空值或非法值时快速失败且不给响应/日志泄密。
- 通过受控文件挂载或部署平台秘密存储注入秘密，审查进程环境、诊断输出、构建参数和回滚时的暴露面。

## 先修与环境

先理解 M22-L01 的 lockfile、release 产物与运行镜像边界。正式前置是 M22-L01，I12-F08 主线门槛尚未满足。当前 starter 是无外部依赖的本机 Rust crate，只用合成配置值；不会读取真实环境凭据，也不启动 Docker 或容器。

## 配置在启动边界解析

区分代码定义的默认行为和部署时的资源地址、端口、功能选项及 credential。变量名保持稳定、细粒度；部署时注入具体值。不要通过 `APP_ENV=prod` 在代码里选择一大包互相隐含的配置，也不要把配置写成编译期 `env!()`：编译期变量会进入产物，运行时 `std::env::var` 才会按每个部署读取。

```rust
let raw = std::env::var("APP_BIND_ADDR")
    .map_err(|_| ConfigError::Missing { name: "APP_BIND_ADDR" })?;
let bind_addr: std::net::SocketAddr = raw
    .parse()
    .map_err(|_| ConfigError::Invalid { name: "APP_BIND_ADDR" })?;
```

应用入口启动前调用 `Config::from_env()`，把已校验配置传给需要它的模块。配置解析失败应终止启动并提供安全、稳定的错误码；不得静默回退到开发 credential、任意 `unwrap()` 崩溃或把原始值拼进错误。只记录变量名/错误码，不记录敏感值。对可选项逐个声明安全默认值和有效范围；必需项缺失必须 fail closed。

Rust 的 `std::env::var` 对不存在或非法变量名返回 `VarError::NotPresent`，对非 Unicode 值返回 `NotUnicode`。日志不应格式化完整 `VarError` 或配置结构来“方便排错”；给操作者的错误只需说明哪个必需设置无效以及修复动作，不包含其值。

## 普通配置与秘密的交付路径

普通配置（例如监听地址）可由部署编排作为环境变量传入。秘密（例如数据库密码、签名密钥、第三方 API token）应由授权的秘密管理机制交付，并限制谁能创建、读取、更新和挂载。应用不要把秘密写进源码、Cargo 配置、`.env` 提交、容器镜像层、命令行参数、构建参数、crash dump、日志或诊断端点。

某些编排器支持将秘密挂到运行时只读文件；应用可以接受 `APP_API_TOKEN_FILE=/run/secrets/api_token` 这样的非敏感路径，然后只在需要时读取文件内容。Docker Swarm secrets 的官方文档描述了授予服务后以内存文件挂载秘密的行为，并明确区别于直接设置环境变量；其他编排器和 Compose 模式有不同语义，必须查其部署模型，不能把路径约定误说成平台安全保证。宿主文件权限、容器 UID、挂载范围、日志代理、备份和轮换流程仍需验证。

```text
运行环境：APP_BIND_ADDR=127.0.0.1:8080
秘密路径：APP_API_TOKEN_FILE=/run/secrets/api_token
应用进程：读取受限挂载文件，拒绝空值，只保留在必要的进程内状态
```

秘密路径变量不是秘密本身，但权限仍需限制。处理 token 的类型应在 `Debug` 中脱敏；避免 `#[derive(Debug)]` 让含秘密配置自动可打印。错误值与日志字段必须有界，不能把 URI 中的 password 原样回传。

## 轮换、关闭与证据

轮换需要同时记录版本与生效顺序：新增秘密版本、授权目标进程读取、更新应用并健康检查、撤销旧版本；若失败，按部署语义恢复仍有效的上一版，不能假设覆盖文件或回滚镜像会自动回滚秘密。进程是否能动态重新读取挂载文件取决于应用实现和编排器更新方式，未实现就需要受控滚动重启。

验证用合成测试值检查：缺失/空值失败、非法格式有稳定诊断、秘密文件输入只采用文件值、配置与错误的 `Debug`/`Display` 不含 sentinel。检查 release executable 中没有通过 `env!` 嵌入的 credential，检查 CI 日志、构建参数和 crash report；在生产前再以目标编排器验证权限、挂载、轮换与回滚。应用单元测试通过不能代替秘密管理服务或部署环境验收。

## 分层提示

1. `env!("APP_TOKEN")` 和 `std::env::var("APP_TOKEN")` 分别在哪个时间读取？哪个可能把秘密嵌进二进制？
2. 缺少数据库 URL 时静默使用本地默认值有什么启动风险？
3. 为什么错误只报告变量名和错误码，而不打印解析器错误、原始值或整份 Config？
4. `APP_API_TOKEN_FILE` 与 `APP_API_TOKEN` 各自携带什么？读取 secret file 还要核对哪些权限？
5. 修改秘密挂载之后，应用何时会观察到新值？如何安全恢复旧版本？
6. 哪些构建、崩溃和日志路径可能泄漏秘密，即使源码没有明文？

## 来源

- [Rust 标准库：`std::env::var`](https://doc.rust-lang.org/stable/std/env/fn.var.html)：运行时读取与缺失/非 Unicode 错误。
- [Rust Book：环境变量](https://doc.rust-lang.org/book/ch12-05-working-with-environment-variables.html)：将运行期配置传入程序。
- [Docker Docs：Manage sensitive data with Docker secrets](https://docs.docker.com/engine/swarm/secrets/)：Swarm secret 授权与文件挂载语义。
- [The Twelve-Factor App：Config](https://12factor.net/config)：将部署配置与代码分离；该原则不替代秘密存储、访问控制或轮换设计。

作者侧只验证使用合成数据的本机 Rust parser；没有连接环境变量 provider、secret store 或任何真实部署平台，也没有验证部署权限、日志代理、秘密轮换与回滚。
