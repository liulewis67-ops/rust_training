# M07-L03 练习：静态分发、dyn 与 dyn compatibility

## 1. 预测：选定类型的时机

对 `render_static(&item)`、`render_static(&batch)` 和 `render_dynamic(&item)` 分别说明具体实现在哪里确定。再解释为什么可将 `QueueItem` 与 `ImportBatch` 放入一个 `Vec<Box<dyn Label>>`，却不能把它们放在同一个 `Vec<T>` 中。

**提示**：分别看泛型实参的单次实例化与 trait object 的被指向值。

**验证契约**：Rust 1.95.0、Edition 2024 下，泛型与 dyn 调用对相同输入给出相同 label；异构对象集合的两项顺序和内容可检查。解释须说出具体类型的编译期/运行期选择差异。

## 2. 修复：让方法成为固定动态接口

```rust
trait Renderer {
    fn render(&self) -> String;

    fn render_with<T: std::fmt::Display>(&self, extra: T) -> String;
}

fn render_both(value: &dyn Renderer) -> String {
    value.render_with(7)
}
```

为 `render_with` 重新设计签名，让它能通过 `&dyn Renderer` 调用任意显示值。用 `&dyn Display` 参数表达擦除后的显示接口，并说明这和加 `where Self: Sized` 的取舍有何不同。

**提示**：对象调用要求 vtable 方法签名固定；若加 `Self: Sized`，方法可留在 trait 中，但 trait object 不能调用它。

**验证契约**：`&dyn Renderer` 可调用 `render()` 和重设计后的 `render_with(&dyn Display)`。原泛型方法版本作为 dyn-dispatch 函数参数时按预期产生 E0038；修复版本能让不同 `Display` 输入经 trait object 调用。

## 3. 实现：异构标签渲染

实现一份 dyn-compatible 的 `Label` trait，并为 `QueueItem` 与 `ImportBatch` 各自实现。完成 `render_all(items: &[Box<dyn Label>]) -> Vec<String>`，验证空集合、单个值和混合类型值的顺序与结果。

再添加一个原生 `async fn` trait 的负例，尝试声明 `&dyn AsyncLabel` 并确认编译失败。不要把宏生成的接口或手工 boxed future 结果当作原生 async 方法可通过 dyn 调用的证据。

**提示**：对象方法接收 `&self` 并返回具体 `String`。async 负例失败原因在于 async fn 的 opaque Future 返回，不是 async trait 实现本身不受支持。

**验证契约**：dyn-compatible 版本对 `QueueItem` 与 `ImportBatch` 的混合数组返回预期标签，空数组返回空结果；原生 async trait object 负例在 Rust 1.95.0、Edition 2024 下以 dyn compatibility 类诊断拒绝。

## 参考答案

1. `render_static(&item)` 与 `render_static(&batch)` 分别在编译期以 `QueueItem` 和 `ImportBatch` 实例化；`render_dynamic(&item)` 通过 `Label` trait object 调用实际实现。`Vec<T>` 的所有元素必须是同一个具体 `T`，而 `Vec<Box<dyn Label>>` 的元素共享指针类型、可指向不同实现。
2. 将方法改为 `fn render_with(&self, extra: &dyn std::fmt::Display) -> String`，调用 `value.render_with(&7)`。参数类型固定，便于放入 vtable。若保留泛型签名并加 `where Self: Sized`，trait 其他方法仍可用于 `dyn Renderer`，但 `render_with` 不能经 trait object 调用。
3. `Label` 使用固定的 `fn label(&self) -> String` 方法；渲染函数可写为：

   ```rust
   fn render_all(items: &[Box<dyn Label>]) -> Vec<String> {
       items.iter().map(|item| item.label()).collect()
   }
   ```

   异构输入可包含 `Box::new(QueueItem { ... })` 和 `Box::new(ImportBatch { ... })`，空数组得到空结果。原生 async trait 方法无法直接用于 `dyn AsyncLabel`，因为其返回 Future 的具体类型不属于固定的对象接口；这不表示具体类型或泛型调用不能使用 async 方法。
