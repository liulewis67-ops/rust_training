# M01-L02 练习：rustup、Cargo、Edition 与项目结构

先独立作答，再展开公开提示和参考答案。命令在自己的电脑上运行，本站不会判定工程能力。

## 练习一 · 预测：仓库里这几个版本号分别表示什么？

### 题面

某 Rust 应用仓库有以下信息：

- `rustup show` 显示当前目录由仓库的 `rust-toolchain.toml` 选择工具链。
- `Cargo.toml` 写着 `name = "log-reader"`、`version = "0.3.1"`、`edition = "2024"`。
- `Cargo.lock` 记录了一组解析后的依赖版本。

请预测：哪个信息决定当前编译器工具链？哪个是这个 Cargo package 的发布版本？哪个是 crate 的 Edition？如果依赖解析结果意外变化，应先检查哪个文件和配置？解释为什么不应把删除锁文件当作第一步。

### 作答契约

- 将 rustup 工具链、package 版本、Edition 和依赖锁文件分别对应到职责。
- 不把 `0.3.1` 当作 Edition，也不把 `2024` 当作 rustc 版本。
- 对锁文件给出保留/检查的理由，不将删除锁文件作为无条件修复。

### 分层提示

1. 找出描述“正在使用的工具”“应用自身身份”“语言语法约定”“依赖解析结果”的字段。
2. `Cargo.toml` 内的 `[package] version` 和 `edition` 是两个独立字段。
3. rustup 根据目录配置选工具链，Cargo 锁文件记录解析后的依赖版本。
4. 查看参考答案并逐项解释每个字段为何不能互换。

### 参考答案

当前工具链由 rustup 的仓库配置选择；package 发布版本是 `0.3.1`；crate 使用 Rust 2024 Edition；Cargo.lock 记录解析后的依赖版本。若依赖不符合预期，先检查 Cargo.toml 声明、Cargo.lock 与 Cargo 输出，确认是否有有意的升级或冲突。应用通常提交 Cargo.lock，直接删除会重新解析依赖，可能改变许多间接版本，不能代替定位原因。

### 自评规程

- 四个职责都正确区分：2 分。
- 明确 package 版本、Edition 与工具链不是同一版本号：1 分。
- 对锁文件采取先检查、再基于原因更新的做法：1 分。

## 练习二 · 修复：整理一份错误的故障回复

### 题面

团队收到报告：“我在这个仓库运行 Cargo，提示缺少工具链组件；另外依赖更新后构建结果不同。”同事回复：

> “把 Cargo.toml 的 package version 改成 rustc 的版本号，Edition 也写同一个值。然后把全局 Rust 默认设成 nightly，并删掉 Cargo.lock，这样大家的环境就一致了。”

请把这段回复改写为安全、可执行的排查步骤。说明分别在哪里查看工具链选择、所需组件、crate Edition 和依赖解析；避免为了消除报错而改变无关版本。

### 作答契约

- 指出 `package.version`、`edition`、rustup toolchain 和 Cargo.lock 的职责。
- 提供至少三项有明确顺序的检查或修复步骤。
- 修复动作限定到仓库实际配置，不未经核对改变全局默认或整个依赖图。
- 对依赖变化和工具链问题分别处理。

### 分层提示

1. 缺组件与依赖解析变化属于两条故障线，不应混成一个版本升级。
2. 先运行 `rustup show` 并检查仓库 `rust-toolchain.toml`。
3. 对照 `Cargo.toml` 的 Edition 与 `Cargo.lock` 的改动，再查看依赖更新来源。
4. 参考答案给出从确认现场到最小修复的顺序。

### 参考答案

“先不要改 package version、Edition 或全局默认。进入仓库运行 `rustup show`，确认当前实际工具链，再读取仓库的 `rust-toolchain.toml` 和所需组件；如果仓库明确需要缺少的组件，就为该工具链补装对应组件并重新检查。随后检查 Cargo.toml 中的 Edition 是否符合项目约定，并查看 Cargo.lock 的具体差异及触发依赖变更的命令。只有在团队决定升级依赖并完成兼容验证时才更新锁文件。把两个问题分别复现和记录，避免让个人全局设置掩盖仓库配置。”

### 自评规程

- 正确区分四个版本/配置概念：1 分。
- 工具链修复限定在仓库声明的工具链和组件：1 分。
- 依赖调查读取 Cargo.lock 差异，未建议无条件删除：1 分。
- 步骤能分别复现、修复并重跑：1 分。

## 练习三 · 实现：交付一个最小 Cargo 应用骨架

### 题面

新成员要在一个空目录中创建命令行程序 `entry-check`。团队约定使用已安装的稳定工具链和 Rust 2024 Edition；本练习不添加第三方依赖。请写出创建项目的命令，并给出最小目录树和需要检查的 Cargo.toml 字段。最后说明如何确认使用了约定工具链，以及应用锁文件何时产生、应如何处理。

### 作答契约

- 在空目录中创建独立二进制 package，不把 Cargo workspace 与 package 混为一谈。
- 目录包含 Cargo.toml 和程序入口 `src/main.rs`。
- Edition 作为 `[package]` 下的 `edition` 字段写明，不伪造一个 rustc 版本号字段。
- 用 `rustup show` 检查实际工具链；通过 Cargo 命令构建/运行后检查输出与锁文件。
- 不需要或添加与任务无关的依赖。

### 分层提示

1. Cargo 默认创建二进制应用时，程序入口在哪里？
2. `cargo new` 接受 package 名称；回到父目录运行后才能找到新建项目。
3. 运行前确认 rustup 选择，再看新生成的 Cargo.toml。
4. 参考答案给出命令、目录树和检查顺序。

### 参考答案

在空目录执行 `cargo +1.95.0 new entry-check --edition 2024`，然后用 PowerShell 的 `Set-Location entry-check` 或 shell 的 `cd entry-check` 进入项目。初始结构至少包含：

```text
entry-check/
  Cargo.toml
  src/
    main.rs
```

检查 Cargo.toml 的 package name 为 `entry-check`、`edition` 为 `2024`；不为这个练习添加依赖。运行 `rustup show` 查看当前目录的默认或覆盖配置，再用 `rustc +1.95.0 --version` 确认本练习的编译器版本，运行 `cargo +1.95.0 run`。阅读运行结果和新生成的 Cargo.lock。应用项目应按仓库约定提交 Cargo.lock；后续更新依赖时评审锁文件 diff。

### 自评规程

- 命令在工作区中生成名为 `entry-check` 的 binary package：1 分。
- 文件树和 manifest 字段准确：1 分。
- Edition 与 rustup toolchain 概念正确：1 分。
- 运行后检查 Cargo.lock 并说明应用锁文件用途：1 分。

## 整体校验说明

三题分别检查版本概念预测、修复工具链/依赖配置误区、按需求建立最小 Cargo 项目。对照公开规程自查后，记录仍不代表平台认证的技能成绩。
