# M13-L05 实验：诊断阻塞运行时

## 实验目标

在受控的 current-thread Tokio runtime 中定位同步等待导致的调度停滞，把有限的同步工作移出 runtime worker，并验证无关任务能在工作尚未释放时继续前进。保留运算结果与资源边界；不要靠增加 worker 数掩盖同步阻塞。

## 场景与交付

你接手一个单线程 runtime 的批量校验入口。它调用一个同步校验器；校验器等待外部阶段门控后才返回。入口目前直接调用它，所以一个同步调用就占住了唯一 runtime worker。项目配有确定性观察器：工作开始时通知控制线程，控制线程唤醒 sibling task，只有确认 sibling 已运行或 watchdog 到期后才打开工作门控。

从 `content/drafts/public/m13-l05-blocking-starter.zip` 解压到新目录，按顺序完成：

1. 复核 `starter-manifest.json` 和 ZIP 哈希，记录工具链与干净工作区版本。
2. 不改观察器，先运行 fmt/check 和回归检查；保存基线编译与行为结果。预期项目可编译，唯一的调度回归断言因 sibling 被阻塞而失败。
3. 用观测事件还原顺序：同步工作开始、控制线程唤醒 sibling、runtime worker 被占住、watchdog 打开门控、同步调用结束、sibling 才运行。
4. 将有限同步工作移至 `spawn_blocking`，处理 JoinHandle 结果。若批量工作共享容量预算，沿用 M13-L04：在提交前取得共享 semaphore permit，并让 closure 持有它直到工作结束。
5. 重新运行公开检查和受控评测。保存修改快照及版本，比较同一门控下的结果、sibling 完成时点和 active 峰值。
6. 将工作区重置到原始 ZIP 的新解压副本，再现预期失败；不要把修复副本复制回起始快照。

## 行为契约

- 每项工作都在 `started` 事件之后等待显式 release；没有固定 sleep 或运行耗时阈值作为通过判定。
- sibling 通过 channel 接收控制信号后报告完成。通过条件要求这条报告先于 release；watchdog 超时只用于防止错误实现卡死。
- 工作返回 `input * 2`，有效输入不得丢失或改变。
- 修复保持 current-thread runtime，禁止增加 worker 数、跳过工作、提前打开门控或删除/弱化观察断言。
- 对批量版本，共享并发预算必须在 spawn 前生效；无界基线要能被同一事件观察器检出。
- 正常退出需 join async task 与控制线程，并回收所有通道/permit；超时路径也要打开 release 门控。

## 公开与受控检查

公开检查反馈 Cargo 结构、格式、构建、样例结果和 sibling 在 release 前是否运行。受控作者侧评测另检查起始版本确实被检出、固定参考修复在相同输入上通过、故意把同步等待移回 runtime 的错误变体仍失败、观察器源文件和检查契约未被改写、起始 ZIP 可干净重置。

平台验收还需把独立提交快照绑定到课程尝试，使用固定 R2 工具链执行，记录评测器/题目版本与故障类别；代码失败与平台超时分开处理。查看参考答案或获得提示的练习可以继续，但不能记录成未看答案的独立能力证据。

## 参考命令

```text
cargo fmt -- --check
cargo check --locked --offline
cargo test --locked --offline
cargo clippy --all-targets --locked --offline -- -D warnings
cargo doc --no-deps --locked --offline
```

## 重置和证据

起始材料和只读观察契约放在公开 starter ZIP；教师参考与错误变体留在 `content/drafts/private-assessment/`。保存 ZIP、manifest、公开检查、参考实现、评测规则和最终工作区的 SHA-256，以及基线/修复/错误变体三组结果、工具链、命令和快照标识。正式 R2 隔离提交、平台重置与独立学习者试做尚未执行；作者侧验证不可替代这些门槛。

## 来源与原创声明

`spawn_blocking` 的用途、pool 限制及已启动后不能由 JoinHandle abort 的行为按 [Tokio API 文档](https://docs.rs/tokio/latest/tokio/task/fn.spawn_blocking.html)核对。事件门控、实验契约和校验场景为原创，不依赖外部网络服务或 Linux 容器。
