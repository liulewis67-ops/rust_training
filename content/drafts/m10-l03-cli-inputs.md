# M10-L03：参数、配置、文件与标准流

> **本节核心问题：** 命令行、配置文件、环境变量与 stdin 同时提供输入时，谁优先，谁必须报错？

## 学习目标

- 解析明确的 CLI 参数与配置文件，并给出可预期的输入优先级。
- 只有更高优先级的来源缺省时才读取环境变量或标准输入。
- 将成功结果写到 stdout，将错误写到 stderr，并为不同失败给出稳定退出码。
- 用子进程测试验证真实 CLI 的参数、文件、标准流和进程结果。

## 先修与环境

完成 M10-L02，理解 package 外部调用与进程集成测试。样例不使用第三方参数解析库：目标是把来源顺序、文件失败和流行为变成明确契约；真实 CLI 项目可根据复杂度选用成熟解析器。

## 场景：同一个配置值来自四个位置

CLI 可能同时看到 `--name`、`--config`、环境变量 `PROFILE_NAME` 和标准输入。本课程明确规定前者优先，但**用户显式指定的配置文件即使不是最终取值来源，也必须按契约验证**。

**先预测：** `--name alice --config missing.toml` 应直接成功使用 alice，还是报文件错误？如果 `--name ""`，是否可以偷偷退回环境变量？

## 输入来源要有唯一优先级

本节定义一条具体规则，从高到低为：

1. 命令行 --name VALUE；
2. --config PATH 指向的配置文件中的 profile_name = VALUE；
3. 环境变量 PROFILE_NAME；
4. 标准输入的一行文本。

只要配置文件路径被提供，文件就必须成功读取和解析；即使命令行参数更高优先，文件缺失或格式错误仍然是配置错误。这让用户不会因高优先级覆盖而误以为坏配置已生效。对于合法配置，取值的优先顺序仍为上表；未配置的来源才回退。显式提供空字符串不是“缺省”，而是一个值，会进入领域校验并报错。

## 解析选项和读取配置

配置文件只接收一个键；空行和以 # 开头的注释行可忽略，重复键或未知键都报配置错误：

~~~text
# one setting per file
profile_name = from_config
~~~

如果配置中没有 profile_name，该层视作缺省。不要把剩余参数盲目当成位置参数。每个 flag 都消费一个值，缺值、未知 flag 和重复 flag 返回用法错误。样例支持 --name 和 --config；配置路径用 PathBuf 表示，不把路径当作 profile 名称。

使用 std::fs::read_to_string 读取小型 UTF-8 配置文件，并保留 Result。打不开、权限失败或非 UTF-8 内容都应到 stderr，不能转换为空配置，否则优先级会悄悄改变。用户能从诊断区分命令错误、配置文件错误和领域输入错误。

## stdout、stderr 与进程退出码

成功时 stdout 只输出格式化报告的一行，stderr 为空，退出码为 0。参数或配置错误退出码为 2；缺省所有输入或名称不合法退出码为 1。错误诊断写到 stderr，stdout 保持为空，方便 shell 重定向成功结果。

只有参数、配置和环境都没有值时才读取 stdin。样例用 Read::read_to_string 直到 EOF，因此适合管道输入；交互终端若一直不关闭输入，程序会继续等待。为了避免等待，更复杂的交互式 CLI 通常使用 read_line 或显式确认提示。本节的子进程验收总是给 stdin 写入测试文本并关闭管道。

子进程测试使用 Command 设置 args/env/stdin，再检查 Output.status、stdout 与 stderr。这样能发现“错误写到 stdout”或“失败仍返回 0”之类只有看函数返回值无法发现的问题。缺配置文件测试必须使用不存在的路径，并断言错误退出码和空 stdout。

## 示例运行

~~~text
PROFILE_NAME=from_env profile-cli --config settings.conf
profile-cli --name from_cli
echo from_stdin | profile-cli
~~~

第二条命令明确覆盖文件、环境与标准输入；第三条只有在没有更高优先值时才会读取管道。多来源同时出现时应遵守一套书面顺序，不要让读取代码先后顺序偶然决定行为。

## 与 Java / Go 对比

Java CLI、Go `flag` 与 Rust 命令行工具都需将输入解析、业务校验、输出边界分开；语言标准库不会自动提供统一的四级配置合并语义。

对自动化脚本，`stdout` 应仅输出机器可消费的成功结果，`stderr` 放诊断信息，退出码区分用法错误与运行故障。
## 检验理解与本地练习

**先预测再验证：** 表格覆盖 CLI 参数、显式损坏配置、环境变量、管道 stdin 的组合。使用子进程断言实际 `stdout`、`stderr` 和退出码，而不是只测试解析 helper。

**验收标准：** 明确区分“未指定”与“已指定但无效”，不会用 `.ok()` 吞掉读取错误或将错误结果伪装成成功。
## 分层提示

1. 输入建模：把命令参数、配置、环境和 stdin 按来源列出；哪些值是 Some，哪些才是真正缺省？
2. 文件处理：read_to_string 的 Err 应沿哪条错误路径报告？能否将其吞掉再读取 stdin？
3. 进程行为：成功/失败的状态码是多少？哪一类输出可以重定向而不混入错误？
4. 测试：启动实际二进制，用 stdin 管道关闭 EOF，再分别检查 status、stdout、stderr。
5. 稳健性：即使命令行值已优先选中，明确提供的 config 文件仍要校验成功。

## 本节小结

- 让项目结构或工具链配置服务于清晰的接口契约。
- 先记录预期，再用编译器、子进程或行为测试观察实际结果。
- 避免为了让代码通过而扩大公开 API、删除错误处理或污染正常输出。

## 来源

- [The Rust Programming Language：Accepting Command Line Arguments](https://doc.rust-lang.org/book/ch12-01-accepting-command-line-arguments.html)
- [The Rust Programming Language：Working with Environment Variables](https://doc.rust-lang.org/book/ch12-05-working-with-environment-variables.html)
- [The Rust Programming Language：Reading a File](https://doc.rust-lang.org/book/ch12-02-reading-a-file.html)
- [Rust 标准库：std::io::Read::read_to_string](https://doc.rust-lang.org/std/io/trait.Read.html#method.read_to_string)

资料用于核对标准库输入 API、命令参数与环境变量用法。优先级、退出码和配置语法为本练习原创契约。
