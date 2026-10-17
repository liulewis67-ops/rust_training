# M06-L04：`'static`、边界与常见误区

## 学完后

- 区分引用类型 `&'static str` 与泛型约束 `T: 'static`。
- 找出字符串字面量为什么可借用为 `&'static str`，并说明 `'static` 引用的数据必须在整个程序运行期有效。
- 解释 `T: 'static` 表示类型中没有比 `'static` 更短的借用，不代表这个值永远不被销毁。
- 根据数据来源和保存范围修复误加的 `'static`，选择借用、拥有值或静态文本接口。

## 先修

完成 M06-L03，能够区分带引用结构体与拥有型结果。本节仅覆盖引用生命周期 `'static`、泛型类型界限 `T: 'static` 及相关 API 选择；不讨论 trait object 的默认对象生命周期规则或内存泄漏技巧。

## 两种写法里的 `'static` 不是同一种位置

### `&'static str`：借用必须能用到程序结束

```rust
/// Returns text embedded in the program binary.
fn builtin_label() -> &'static str {
    "worker ready"
}

fn main() {
    let label: &'static str = builtin_label();
    println!("{label}");
}
```

字符串字面量的文本存放在程序映像中，可以在整个程序运行期间读取，因此可得到 `&'static str`。返回这个引用本身不会复制文本。调用方也可以把该引用缩短后用于更小的作用域；标注描述的是引用允许覆盖的最长区域，不是命令某个局部变量一直存在。[Rust Book 对 `'static` 的说明](https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html#the-static-lifetime)

函数若把普通参数写成 `&'static str`，就要求调用者传入确实满足 `'static` 的文本：

```rust
/// Accepts only text that is valid for the whole program.
fn print_program_label(label: &'static str) {
    println!("{label}");
}

fn main() {
    print_program_label("built-in");
}
```

如果函数只在调用期间读取用户传入的文本，通常应写 `fn print_label(label: &str)`，而不是无故把接口收窄到 `'static`。`&'static str` 不是“任何字符串引用”，也不适合用来压住借用检查错误。

### `T: 'static`：值的类型不含短期借用

```rust
/// Accepts any value whose type contains no short-lived borrow.
fn pass_static_type<T: 'static>(value: T) -> T {
    value
}

fn main() {
    let owned = String::from("owned text");
    let returned = pass_static_type(owned);
    println!("{returned}");

    let number = pass_static_type(42_u32);
    println!("{number}");

    let literal: &'static str = "embedded text";
    println!("{}", pass_static_type(literal));
}
```

`String` 和 `u32` 这两种拥有型值满足 `T: 'static`，因为类型本身不借用局部数据；但 `String` 仍会在 owner 离开作用域时被销毁。`&'static str` 也满足该界限。相反，指向局部变量的 `&str` 通常不能作为 `T: 'static` 传入：引用类型携带的生命周期短于 `'static`。[Rust Reference 对 `T: 'a` 的定义](https://doc.rust-lang.org/reference/trait-bounds.html#lifetime-bounds)

下面的负例借用局部 String，不满足泛型界限：

```rust
fn pass_static_type<T: 'static>(value: T) -> T {
    value
}

fn main() {
    let owned = String::from("local");
    let borrowed = owned.as_str();
    let _result = pass_static_type(borrowed);
}
```

借用 `borrowed` 只能在 `owned` 有效期间读取；函数要求其类型内所有借用都至少满足 `'static`，因此此调用被编译器拒绝。把 `borrowed` 的类型写成 `&'static str` 不能改变 `owned` 的实际寿命。若确实要把内容保存到任意时长，调用方应传入拥有值，或明确提供真正的静态数据。

## 值满足 `T: 'static` 仍可提前释放

```rust
fn consume_static_type<T: 'static>(_value: T) {
    println!("accepted type; value is dropped when this function ends");
}

fn main() {
    let owned = String::from("temporary owner");
    consume_static_type(owned);
    println!("the String owner was consumed");
}
```

这个函数接收 `String`，类型满足 `'static` 界限；传入时仍 move 了 owner，函数结束后 String 被销毁。`T: 'static` 说的是类型不会携带一个短于 `'static` 的借用，不是变量必须存活到程序结束。不要把它与 `&'static T` 混为一谈。

## 选择签名时从数据来源出发

```text
调用方只需同步查看输入片段
    → &'a str / View<'a>
    → 无文本复制；调用方保留输入至最后一次使用

结果需要脱离输入作用域保存
    → String / 拥有型结构体
    → 创建拥有型数据；返回结果可独立保存

程序内置且固定的标签
    → &'static str
    → 借用程序映像中的文本

泛型值不得携带短期借用
    → T: 'static
    → 允许拥有型 String；不允许普通的局部借用
```

### 常见误区

- “编译器建议 `'static`，加上就行。” 静态标注不会延长局部 owner；先追踪数据来源并选择正确的持有方式。
- “`String: 'static` 意味着 String 永不释放。” 它只说明类型没有短期借用；owner 仍按正常移动和作用域销毁。
- “`&str` 就是 `&'static str`。” 普通 `&str` 的来源可能是调用方的局部 String，其有效范围由该 owner 决定。
- “所有要异步或稍后使用的值都只能是静态引用。” 拥有型数据也可独立保存；本节不把特定运行时边界规则泛化到所有 API。

## 分层提示

1. **定位提示**：看 `'static` 出现在 `&'static str` 还是 `T: 'static` 的位置。
2. **来源提示**：引用来自字面量、静态项、调用方输入，还是局部 String？
3. **类型提示**：`T: 'static` 看 `T` 内部是否携带短期借用；`String` 虽拥有堆数据仍满足该界限。
4. **参考方案**：固定内置文本可用 `&'static str`；请求期间查看用 `&str`；要脱离输入保存就返回 `String` 或拥有型结构体。

## 来源

- [The Rust Programming Language：The `'static` Lifetime](https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html#the-static-lifetime)
- [The Rust Reference：Lifetime bounds](https://doc.rust-lang.org/reference/trait-bounds.html#lifetime-bounds)
- [Rust By Example：Static](https://doc.rust-lang.org/rust-by-example/scope/lifetime/static_lifetime.html)

概念对照、案例、检查步骤和选择图为原创；来源用于核对静态引用、`T: 'static` 的含义及持有型数据的生命周期边界。
