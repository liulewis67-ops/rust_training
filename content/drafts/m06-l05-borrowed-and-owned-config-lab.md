# M06-L05：实验——借用配置视图与拥有型配置

下载[实验起始项目 ZIP](./public/m06-l05-starter.zip)，解压到新目录，先阅读 README、清单和公开契约测试。项目包含两种同输入解析 API；起始 `queued_config` 把借用字段直接放进拥有型 `String` 字段，应因类型不匹配不能通过 `cargo check`。

## 实验目标

- 实现对同一配置输入提供一致业务字段的借用视图和拥有型返回值。
- 证明 `ConfigView` 的字段来自原始输入，调用方在视图最后一次使用前保留输入 owner。
- 让 `queued_config` 返回独立拥有的 `Config`，使调用方能在源输入销毁后继续读取。
- 比较借用版不复制字段文本与拥有版复制/分配字段的使用边界。

## 行为契约

- `parse_view(line)` 和 `parse_owned(line)` 都按第一个 `=` 分隔为 key/value；没有分隔符时均返回 `None`。
- 空 key、空 value 和后续额外 `=` 均保留原输入字段语义；不得硬编码样例。
- `ConfigView<'source>` 的 key 和 value 都借用输入 `line` 的原始 UTF-8 切片。
- `Config` 的两个字段均为 `String`，可独立于输入保存；`queued_config` 必须输出 `MODE` / `cache`。
- `queued_config` 的源字符串离开函数作用域后，返回结果仍可读；不得泄漏源字符串或把局部视图标为 `'static`。
- 不联网、不读写文件、不使用第三方 crate；不得修改公开函数名、返回值语义或公开契约测试。

## 实验步骤

1. 解压 ZIP，记录 ZIP SHA-256、`starter-manifest.json`、rustc 和 cargo 版本。
2. 执行 `cargo check --offline`，记录 `queued_config` 的起始类型错误；判断 `&str` 字段和 `String` 字段各自的持有责任。
3. 修改 `queued_config`，让两个字段转成拥有型文本，或复用拥有型解析接口；不要返回指向局部 `line` 的 `ConfigView`。
4. 执行 `cargo test --offline`，核对同输入结果、空字段/缺失分隔符、UTF-8 字段指针范围和输入结束后的队列结果。
5. 检查一个错误方案：让借用解析器直接返回借用视图作为队列结果。方案不能满足源输入销毁后仍可用的契约。
6. 运行 `cargo fmt -- --check`、`cargo check --offline` 和 `cargo test --offline`。
7. 将起始 ZIP 解压到另一个新目录，核对 manifest 的每个文件哈希并复现原始失败；从重置副本完成修复并记录版本。

## API 选择依据

借用视图以 `&str` 字段指向输入，不复制字段内容；它要求输入 owner 覆盖视图的读取区间。拥有型 `Config` 把两个字段复制进 `String`，需要额外分配，但可脱离输入作用域继续留在队列。队列契约明确要求跨过源输入作用域，因此这里选择拥有型返回值。

## 重置与验收边界

保留发行的错误起始 ZIP 和版本清单。重做时从新目录解压并复核哈希，不能用已经修复的工作区代替原始失败起点。作者本机快照验证不代表 R1 隔离、平台保存历史或平台重置服务。

## 来源

- [The Rust Programming Language：Lifetime Syntax—Structs That Hold References](https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html#lifetimes-in-struct-definitions)
- [Rust standard library：str::split_once](https://doc.rust-lang.org/std/primitive.str.html#method.split_once)
- [Rust standard library：ToOwned](https://doc.rust-lang.org/std/borrow/trait.ToOwned.html)

实验契约、起始实现、公开测试和配置场景为原创；来源用于核对结构体引用有效期、首次分隔切片及从借用文本生成拥有字段。
