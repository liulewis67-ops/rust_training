# M03-L03 三道短练习草案

状态：课前草稿；依赖 M03-L02，尚未接入课程目录或 R1。

## 1. 预测：有结果和无结果

```rust
/// Looks up the label for two known codes.
fn label_for(code: u8) -> Option<&'static str> {
    match code {
        1 => Some("bronze"),
        2 => Some("silver"),
        _ => None,
    }
}

/// Converts an optional label into a display message.
fn message_for(code: u8) -> &'static str {
    match label_for(code) {
        Some(label) => label,
        None => "unknown",
    }
}

/// Prints a hit and a miss.
fn main() {
    println!("{}", message_for(2));
    println!("{}", message_for(9));
}
```

预测两行输出，并解释 9 为什么会走 `None` arm，而不是得到一个空的标签。

**契约：** 输出依次为 `silver`、`unknown`；指出 `label_for` 的返回类型允许未命中。

**分层提示：** ① 比较两个调用的 code。② 列出两个明确编码与默认 `_`。③ 跟踪 `None` 到 `message_for`。

## 2. 修复：不要在未命中时 panic

```rust
/// Returns a title for a small set of codes.
fn title_for(code: u16) -> Option<&'static str> {
    match code {
        10 => Some("standard"),
        20 => Some("priority"),
        _ => None,
    }
}

/// Incorrectly assumes every code has a title.
fn title_or_panic(code: u16) -> &'static str {
    title_for(code).unwrap()
}

/// Panics for an unknown code in the current version.
fn main() {
    println!("{}", title_or_panic(99));
}
```

修复函数和调用点，让命中 10 时输出 `standard`，未命中 99 时输出 `not found`；两条路径都不得 panic，也不能把无值隐式替换成空字符串。

**契约：** 最终公开调用必须显式处理 `Some` 和 `None`；不得留下无条件 `unwrap()`。

**分层提示：** ① 函数签名是否允许未命中？② 调用方如何查看两个变体？③ 为每种情况选出符合输出契约的文字。

## 3. 实现：按代码查找费率

实现 `rate_for`：代码 1 返回 `Some(120)`，代码 2 返回 `Some(250)`，其他代码返回 `None`。调用方 `show_rate` 应在有值时返回 `rate available`，无值时返回 `no rate`。

```rust
/// Looks up the rate associated with a code.
fn rate_for(code: u8) -> Option<u32> {
    // TODO: return Some for supported codes and None for all others.
    todo!()
}

/// Produces an explicit message for a found or missing rate.
fn show_rate(code: u8) -> &'static str {
    // TODO: handle both Option variants and build the agreed message.
    todo!()
}
```

**契约：** `rate_for(1)` 为 `Some(120)`，`rate_for(2)` 为 `Some(250)`，未支持代码为 `None`；`show_rate(1)` 与 `show_rate(2)` 为 `rate available`，`show_rate(0)` 和 `show_rate(255)` 为 `no rate`。不得使用 `unwrap()`，也不能只识别题目中的四个测试值。

**分层提示：** ① `rate_for` 用 match 返回 `Some` 或 `None`。② 在 `show_rate` 再对返回值 match。③ `Some(_)` 可表示某个费率已找到，不必在标签中显示具体数字。
