# I01-F06：WSL 安装与 Linux 容器验收

- 日期：2026-10-15
- 结果：通过；Windows 主机开发，Linux 容器验收在 Ubuntu 22.04 WSL2 中完成。
- 用户范围：课程浏览与课程内容之前已指定优先完善；本次只完成 I01-F06 环境安装、Runner 修复和 Linux 隔离验收，执行内容继续暂停。
- 验收提交：`c38da5043660b640162f4706a20d5c8f490a91ba`。

## WSL 与工具链

- WSL 发行版：Ubuntu 22.04.5 LTS，WSL2，x86_64；内核 `6.18.54.1-microsoft-standard-WSL2`，systemd 为 PID 1。
- Windows 项目目录从 WSL 挂载为 `/mnt/e/personal_projects/rust_training`。
- Linux Node.js：`v22.19.0`；npm：`10.9.3`。从 Node.js 官方发行包安装到 `/opt/nodejs`，校验官方 SHA-256 后安装系统链接。
- Docker Engine：Ubuntu Jammy `docker.io`，Server `29.1.3`；containerd `2.2.1`、runc `1.3.4`。
- 默认 Docker context：`r1-wsl-native`，endpoint `unix:///run/docker-native.sock`。WSL 内 Docker Desktop 遗留 `/var/run/docker.sock` 代理会挂起；使用独立 Unix socket 避免误连该代理。
- WSL 启动参数包含 `apparmor=1 security=apparmor`；`securityfs` 通过 `/etc/fstab` 挂载到 `/sys/kernel/security`。终止并重新启动 WSL 后，AppArmor 模块显示 `Y`、服务为 active、securityfs 已挂载，证明设置持久生效。
- `docker info` 安全选项：`name=apparmor`、`name=seccomp,profile=builtin`、`name=cgroupns`。

## Runner 实施修复

WSL 集成实测发现，向已停止容器执行 `docker cp` 时，内容写入容器层；容器启动后被 `/workspace` tmpfs 卷遮蔽，导致编译容器看不到源码。Runner 现先启动受限 staging 容器并挂载工作卷，再把源码复制到已挂载卷，编译与运行容器随后共享此卷。staging 容器加入持久化清理队列，并在结束时清理。另修复 Docker 输出超出 Node 缓冲区时将捕获的大量输出写回终端的问题；现在只报告受限输出错误。

## 镜像构建

- 执行入口：从 WSL 项目目录运行 `npm run r1:image` 与 `npm run r1:run -- <source.rs>`，通过 Linux Node 调用 Runner。
- Rust 基础镜像固定为 `rust:1.95.0-slim-bookworm@sha256:d7482085ff5b415f84dba5647ae71606650bdef00db7aeb69f4b3d170c3e4082`，构建平台为 `linux/amd64`；Dockerfile 构建阶段使用 `--network=none`。
- 镜像标签：`rust-training-r1:1.0.0`；本轮复验镜像 ID：`sha256:47656bf8e35b089d5135367f97a2f412a96028767c98b3fae890905f8a91acd1`。镜像标签记录 Rust `1.95.0`、环境 `1.0.0` 和固定 base digest。
- 冷构建下载的主镜像层为 `285,995,361` 字节（约 286 MB），初次拉取及构建约 27–28 分钟。之后命中本地缓存的 Runner 镜像构建耗时约 1.4–5.1 秒；重启 WSL 后实测一次为 4.130 秒。

## Linux 隔离验收

所有程序通过 WSL 中的 Runner 和上述 Linux 镜像执行。

| 场景                 | 观察结果                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 普通 Rust smoke 程序 | 编译和运行成功；重启 WSL 后及本轮复跑均成功，本轮编译约 1,112 ms、运行约 407 ms。                                              |
| 宿主挂载检查         | 容器内 `/mnt/c/Users` 和项目挂载 `/mnt/e/personal_projects` 不存在。                                                           |
| 网络隔离             | 程序尝试连接 `1.1.1.1:53`，连接失败，程序断言通过。                                                                            |
| 子进程上限           | 程序创建子进程并断言数量大于 0 且小于 32，Runner 成功。                                                                        |
| 内存上限             | 程序实际触碰 512 MiB 分配；容器产生 Docker `oom` 事件并被终止，Runner 清理成功。                                               |
| 执行超时             | 无限循环程序在配置的 5 秒限制后被终止；观测耗时约 5.126 秒，Runner 返回失败并清理。                                            |
| 输出上限             | 程序产生超过 262,144 字节的输出；Runner 以简洁错误 `Docker output exceeded the 262144-byte limit` 拒绝并清理，不回显巨型缓存。 |
| 容器安全配置         | 程序内 `/proc/self/attr/current` 为 `docker-default (enforce)`，`/proc/self/status` 中 `Seccomp: 2`；断言通过。                |
| 清理与重启           | WSL 重启后 Docker 服务正常；没有 `rust-r1-` 容器、卷、`.pending` 清理记录或 `/tmp/rust-r1-*` 源码目录。                        |

## Windows 代码质量检查

- `pnpm exec vitest run src/scripts/r1-container-runner.test.ts src/scripts/r1-cleanup-queue.test.ts`：2 个测试文件、20 个用例通过（Runner 14，清理队列 6）。
- 对两个实现文件和两个测试文件运行 ESLint：通过。
- Prettier 检查/格式化目标文件：通过。
- WSL Node `node --check` 对两个 Runner `.mjs` 文件检查：通过。
- `git diff --check`：通过。
- Linux Node 下直接启动 Vitest 时，仓库 Windows `node_modules` 缺少 Rollup Linux optional package；Linux 集成验收不依赖 Vitest，在 WSL 原生 Docker 中逐项运行。无需也未改动仓库依赖安装。

## 验收结论

I01-F06 所需的 WSL 安装、Linux Runner 调用、普通运行、资源约束、网络与宿主路径隔离、终端输出上限、容器清理和重启恢复均已实测。F06 的依赖解除后，I01-F07、I01-F08 可以启动，但本次不启动执行内容或后续阶段。
