# M22-L01：release 构建、目标平台与运行镜像

## 学完后

- 选择并记录 Cargo release profile、Rust target triple、CPU/ABI 和操作系统运行时边界。
- 从固定 Cargo.lock 生成 release binary，解释 host 与 target 不同的交叉编译要求。
- 设计 builder/runtime 分离的镜像构建，并列出最终镜像必须保留的依赖和验证。

## 先修与环境

完成 Cargo workspace、lockfile 与 features 基础，理解部署产物是具体平台的 executable，容器共享宿主 kernel。M22-L01 的正式前置是 I12-F08；当前只做课程作者侧本机预写，不满足正式里程碑顺序。Windows 本地会验证 native `x86_64-pc-windows-msvc` release；不会启动 Docker、Linux 容器或真实运行镜像。

## Build profile 是产物行为的一部分

`cargo build` 默认使用 dev profile；`cargo build --release --locked` 选择 release profile 并使用 lockfile。profile 会改变优化、debug assertions、溢出检查、debug info、LTO 等编译设置。Cargo 默认 release `opt-level=3`、关闭 debug assertions 和 overflow checks、`panic=unwind`；这不是“每个服务都应照抄的性能答案”。如果依赖 overflow checks、可捕获 panic、可读堆栈或可重现延迟，必须先测量并有意识地选择设置。Release 产物仍需跑行为测试和 smoke test；不能因 profile 名字叫 release 就跳过。

```powershell
rustc -vV
rustup target list --installed
cargo test --locked
cargo test --release --locked
cargo build --release --locked
```

starter 会输出 `std::env::consts::{OS, ARCH}` 和 `cfg!(debug_assertions)`，将运行时观察与当前编译 profile 对照。`cargo test --release` 的测试也属于 release profile；debug test 的断言值不能代表 release executable。Windows build 得到 `.exe`，不能直接复制到 Linux 镜像。

## Host、target triple 与依赖闭包

`rustc -vV` 中的 `host` 表示编译器本身运行的平台；`--target` 选择输出代码的平台。例如 `x86_64-unknown-linux-gnu` 表示目标 arch/OS/ABI，`x86_64-pc-windows-msvc` 是不同 executable/ABI。Rust target triple 不是 Docker image platform 字符串的一一替代：image `linux/amd64` 还需与 libc、动态库、TLS CA roots、DNS、时区资料、C ABI 与 CPU 基线兼容。

```powershell
rustup target add x86_64-unknown-linux-gnu
cargo build --release --locked --target x86_64-unknown-linux-gnu
```

命令只适用于有对应 Rust std 和链接器的构建机；native Windows 下给 Linux target 安装标准库不等于已配置 Linux linker、C toolchain 或运行时。最终要在匹配的隔离目标环境执行 smoke/integration tests，检查动态库、启动用户、监听地址、健康检查、架构与依赖版本。此课包未运行上面的 Linux 构建。

## Builder 与 runtime 镜像职责分离

多阶段镜像让 builder stage 拥有编译器、Cargo registry cache、源代码和 `target` 目录；runtime stage 只复制版本确定的 executable 和确有需要的 runtime dependencies。最终镜像使用固定 digest 和 target platform，采用非 root UID，限制 capabilities，固定 entrypoint 与工作目录；不复制 `.env`、Cargo credentials、private registry token、builder cache 或参考答案。glibc/musl、证书、时区文件、动态加载库、静态文件和 SQL migration 都要按应用显式审查。`FROM scratch` 并不会自动满足这些运行时需求。

```dockerfile
# 概念结构：实际 base image 必须按架构与 digest 锁定后验证。
FROM rust-builder@sha256:<verified-builder-digest> AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release --locked --target x86_64-unknown-linux-gnu

FROM service-runtime@sha256:<verified-runtime-digest> AS runtime
COPY --from=build /src/target/x86_64-unknown-linux-gnu/release/service /usr/local/bin/service
USER 10001:10001
ENTRYPOINT ["/usr/local/bin/service"]
```

这只是结构片段，placeholder digest 不可用于构建；也未承诺任何具体二进制可以在该 runtime image 启动。Docker multi-stage 可减少 final stage 带入的编译工具和无关文件，但不能替代镜像扫描、SBOM、签名、版本固定、启动测试和回滚验证。

## 版本与可追溯性

发布记录至少绑定源码 commit、Rust/Cargo 版本、Cargo.lock hash、feature/target/profile、构建环境 digest、产物 hash、镜像 digest、依赖来源、签名和 smoke-test 输出。`--locked` 确保命令不改写 lockfile；它本身不证明构建可重复、依赖无漏洞、产物被签名，或镜像跨架构运行正确。多架构发布应为每个 target 独立构建与运行验收，并核对 registry manifest list 映射。

## 分层提示

1. `host=x86_64-pc-windows-msvc` 为什么不能证明二进制可放进 `linux/amd64` 镜像？
2. release 测试为什么要执行 `cargo test --release`，而不是只测试 dev profile？
3. release profile 默认关闭了哪些检查？这对溢出合同和 panic 行为有什么影响？
4. `--target` 成功解析后，还可能缺少哪几种链接器/ABI/runtime 条件？
5. 哪些文件应只留在 builder stage？哪些运行文件可能需要复制到 runtime？
6. builder 和 runtime base image 都用 tag `latest` 会损害什么可追溯性？
7. 小镜像如果缺少证书或 glibc 动态库，编译成功为什么依然不能发布？

## 来源

- [Cargo Book：Profiles](https://doc.rust-lang.org/cargo/reference/profiles.html)：dev/release profile 与编译选项。
- [Rustc Book：Platform Support](https://doc.rust-lang.org/stable/rustc/platform-support.html)：target triple 与平台支持等级。
- [Rustc Book：Targets](https://doc.rust-lang.org/rustc/targets/index.html)：target 与交叉编译入口。
- [Docker Docs：Multi-stage builds](https://docs.docker.com/build/building/multi-stage-builds/)：builder/runtime stage 与选择性复制。
- [Docker Docs：Multi-platform builds](https://docs.docker.com/build/building/multi-platform/)：镜像 OS/architecture platform 与 CPU 架构兼容。

作者侧只验证本机 Windows crate 的 release build/test。没有运行 Dockerfile、Linux target、runtime image、SBOM/signature、multi-arch manifest 或正式 R2/R3 image smoke test。
