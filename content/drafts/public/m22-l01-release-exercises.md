# M22-L01：三道短练习

## 1. 预测：哪一个产物能运行？

构建机显示 `host: x86_64-pc-windows-msvc`，命令 `cargo build --release --locked` 生成 `service.exe`。镜像 manifest 写 `linux/amd64` 且 runtime 是 Debian glibc。预测直接复制该 `.exe` 后能否启动；列出要生成正确 Linux artifact 还缺少的构建/运行证据。

**契约**：必须分开 host、Rust target triple、镜像 platform、ABI 和实际 smoke test；不把 OS/CPU 名称相似视为可执行兼容。

## 2. 修复：builder 工具泄漏到最终镜像

给定 Dockerfile 把整份 `target/`、Cargo registry、源码和 builder stage 复制到 runtime，并使用 `rust:latest`。修改为多阶段结构，只复制指定 target 的 release executable 与明确需要的 runtime 文件；把镜像 tag 迁移到 digest pinning 占位符，并写出运行验证清单。

**提示**：Dockerfile 文本修复不是镜像构建通过；placeholder digest 不能冒充已验证版本。

## 3. 实现：产物运行信息

完成 starter 的 `build_facts()`，输出包版本、编译目标 OS/arch 与 debug assertion 配置；通过 debug/release profile 分别验证输出与 `cargo test --release` 的配置一致。补充报告记录 Cargo.lock SHA、target triple 和 release executable hash。

**提示**：用 `std::env::consts` 和 `cfg!(debug_assertions)`，不要从机器 hostname 推断 executable target，也不要硬编码当前 Windows 环境值。
