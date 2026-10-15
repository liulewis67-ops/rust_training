# M07-L06 检查：为运行时策略流水线选择分发方式

## 独立任务

团队要检查构建工件是否满足发布条件。单个静态调用可以由具体策略类型决定；新需求改为：管理员在运行时组合不同策略，列表可以存放未来新增的策略类型；按配置顺序检查，第一项拒绝后立即返回其原因；空策略列表表示没有额外限制。

在下面的 API 中实现 `evaluate_pipeline`，让异构 `Gate` 实现通过 trait object 保存在同一列表中。不要用 enum 把已知实现类型写死，也不要为这个列表再引入一个仅转发调用的 wrapper 类型。保留 `evaluate_one<G: Gate>` 作为单一具体类型的泛型对照。

```rust
/// Describes one release condition over a build record.
trait Gate {
    /// Accepts the build or explains why this gate rejects it.
    fn evaluate(&self, build: &Build) -> Result<(), String>;
}

/// Holds metadata checked by release gates.
struct Build {
    number: u32,
    channel: String,
}

/// Requires a minimum build number.
struct MinimumNumber(u32);

/// Requires a specific release channel.
struct ChannelIs(String);

/// Checks one concrete gate through static dispatch.
fn evaluate_one<G: Gate>(gate: &G, build: &Build) -> Result<(), String> {
    gate.evaluate(build)
}

/// Checks a configured heterogeneous gate pipeline.
fn evaluate_pipeline(gates: &[Box<dyn Gate>], build: &Build) -> Result<(), String> {
    // TODO: evaluate each configured gate in order and preserve its first error.
    Ok(())
}
```

为 `MinimumNumber` 与 `ChannelIs` 实现 `Gate`。在答案说明中交代为什么单个 `G` 适用于一个具体类型，而 `Box<dyn Gate>` 支持混合类型的运行时策略列表；再指出 trait 为何可用作 dyn，以及添加泛型方法或原生 async 方法会怎样影响 dyn compatibility。说明动态分发提供的灵活性和间接调用代价，不作未测量的总体性能结论。

## 公开行为契约

- 单条策略可以使用 `evaluate_one`，成功和拒绝原因符合策略自身条件。
- `MinimumNumber` 与 `ChannelIs` 可同时存放在 `Vec<Box<dyn Gate>>`，按列表顺序检查。
- 首个失败原因原样返回，不继续覆盖它；全部通过时返回 `Ok(())`。
- 空切片不增加限制，返回成功。

## 失败反馈

若管线总返回 `Ok(())`，反馈指出“策略列表已保存，但调用者尚未执行列表中的 gate”；若只接受某个具体 gate 类型，反馈指出“接口仍固定一个编译期类型，无法满足异构运行时集合”；若返回笼统错误，提示保留首个拒绝原因。看过本题参考答案后完成的版本不计独立通过证据。

## 分层提示

1. **定位提示**：`gates` 的元素类型已经是 `Box<dyn Gate>`，循环可直接调用 trait 方法。
2. **控制流提示**：`Result` 的 `?` 可在首个 `Err` 时返回，空循环自然返回最终 `Ok(())`。
3. **设计提示**：泛型和 trait object 可以同时存在于一套 API 中，各自服务于不同类型选择时机。
4. **参考方案**：逐项执行 `gate.evaluate(build)?`，循环正常结束后返回 `Ok(())`；核对错误值没有被改写。

## 来源

- [The Rust Programming Language：Using Trait Objects](https://doc.rust-lang.org/book/ch18-02-trait-objects.html)
- [The Rust Reference：Trait objects](https://doc.rust-lang.org/reference/types/trait-object.html)
- [The Rust Reference：Dyn compatibility](https://doc.rust-lang.org/reference/items/traits.html#dyn-compatibility)

构建发布门禁场景、题面、失败反馈及考查契约为原创；来源用于核对动态分发和 trait object 的兼容约束。
