# M10-L04 短练习：feature、锁文件和文档

## 1. 修复：诊断 feature 污染 stdout

某同学加入 trace-input-source feature，但 feature 打开后子进程输出变成：

~~~text
profile-cli: input source: command-line
profile=training_user
~~~

成功时 stdout 应只包含 profile 报告，诊断写 stderr。请修复 feature 分支，并补充或调整一个进程断言，确保默认构建 stderr 为空、feature 构建 stderr 包含来源标签，两个构建的 stdout 完全一致。

**分层提示**

1. 查找 feature 分支使用的输出宏。
2. 诊断流和机器可读的成功结果分别适合写入哪里？
3. 用默认和 --features trace-input-source 两种测试命令验证。

## 2. 实现：增加可观察的 trace-input-source feature

给 profile-cli 加入显式空 default 集合与 trace-input-source feature。实现来源选择标签：command-line、config-file、environment、stdin。开启 feature 时，只向 stderr 输出当前来源；默认 feature 下 stderr 为空。stdout 一直是同一 profile 报告。

补充真实二进制测试，覆盖至少 CLI 参数、配置、环境和 stdin 来源，并说明以下命令验证什么：

- cargo test --workspace --no-default-features --locked --offline
- cargo test -p profile-cli --features trace-input-source --locked --offline
- cargo test --workspace --all-features --locked --offline

**分层提示**

1. 让来源选择函数返回名称与来源枚举，而不是在每个输入分支复制输出逻辑。
2. feature 使用 cfg 在编译期包住额外 stderr 行。
3. 断言 feature 开启前后的 stdout 完全相同。

## 3. 设计评审：版本范围与互斥格式

评审方案：把每个依赖都写成精确版本；手动编辑 Cargo.lock；添加 json-output 和 text-output 两个互斥 features，由用户通过重新编译选择最终输出格式。请指出至少三个维护或行为问题，给出适合这个 workspace 的依赖/锁文件策略，以及如何选择运行时输出格式。

讨论 feature 在依赖图中合并时，互斥方案为什么容易产生难以组合的构建，并指出 README、测试矩阵和文档要怎样同步。

**分层提示**

1. 分清 manifest 版本范围和 lock 的精确解析结果。
2. Cargo features 面向编译期可选能力，不能假设依赖方的开启状态是私有的。
3. 若只是用户运行时偏好，考虑 CLI flag/config；测试默认与 all-features 两条契约。
