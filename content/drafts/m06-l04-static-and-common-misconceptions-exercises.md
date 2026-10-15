# M06-L04 练习：`'static`、边界与常见误区

## 1. 修复：不要要求调用方传静态引用

`log_label` 只会在函数调用时打印传入标签，不会保存它。当前签名拒绝从调用方的局部 String 借用标签。修改接口，让字面量和局部字符串都能使用，并解释修改前的问题。

```rust
fn log_label(label: &'static str) {
    println!("{label}");
}

fn main() {
    let request_label = String::from("request-17");
    log_label(request_label.as_str());
}
```

**提示**：函数不把引用存起来；用省略生命周期的 `&str` 表达调用期间的短暂借用。

**验证契约**：局部 String 可借用传入，程序输出 `request-17`，调用方仍持有 String；字面量调用同样可编译。不得克隆字符串或把局部值伪装成 `'static`。

## 2. 实现：检查泛型静态类型界限

实现 `pass_static_type<T: 'static>`，原样返回传入值。补充调用验证 `String`、整数和 `&'static str` 均可用，并确认返回结果仍可读取。

```rust
fn pass_static_type<T: 'static>(value: T) -> T {
    // TODO: Return the owned or static-reference value unchanged.
    todo!()
}
```

**提示**：这里约束的是类型中不能藏有短期引用，不是要求参数必须是 `&'static T`。

**验证契约**：`String`、`u32`、字面量引用三种输入通过编译并保持值不变；单独的负例把局部 `&str` 传入时应被拒绝。说明拥有型 String 可满足 `T: 'static`，但函数结束后仍可正常销毁。

## 3. 设计评审：为结果边界选择类型

为以下三个 API 选择返回类型并说明调用方责任：

1. `builtin_status()` 返回编译进程序、不会变化的固定标签。
2. `parse_request(input)` 只在本次请求期间让调用方查看输入字段，不保存结果。
3. `enqueue_job(input)` 把解析结果放入稍后处理的队列，原始输入函数返回后就不再保留。

候选形式：`&'static str`、`View<'a>`/`&'a str`、`String`/拥有型结构体。至少说明一个不适合的替代设计及其代价或有效期错误。

**提示**：先判断结果是程序内置、同步借用，还是要独立跨作用域保存，再讨论是否复制字段。

**评审契约**：分别选择 `&'static str`、借用视图、拥有型结果；指出借用 view 零复制但调用方要保留输入，拥有结果有复制/分配成本但可进入队列。不可把 `T: 'static` 解释为值不会释放，也不可用 `'static` 隐藏局部引用。
