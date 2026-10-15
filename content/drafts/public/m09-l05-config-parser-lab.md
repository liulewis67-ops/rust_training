# M09-L05：实验——实现带错误位置的配置解析器

## 实验目标

为一个小型服务配置编写严格解析器，在拒绝错误配置时指出字段和准确位置。完成后能解释：

- 为什么错误类型应保留类别、字段和位置，而不保存或回显原始配置值；
- 如何处理空值、格式错误、缺失字段和重复字段；
- 行号与列号从哪里计数，以及 Unicode 列号为什么不能直接使用 UTF-8 字节偏移；
- 如何通过行为测试区分解析失败与编译失败。

## 输入与输出契约

输入是 `key=value` 行组成的 UTF-8 文本，字段可按任意顺序出现，空行忽略。只接受下面两个必填字段，且每个必须恰好出现一次：

| 字段 | 类型 | 示例 |
|---|---|---|
| `timeout_ms` | `u64` 十进制数字 | `timeout_ms=250` |
| `retry_limit` | `u8` 十进制数字 | `retry_limit=3` |

不允许空格、注释、未知字段或重复字段。数字值只能包含 ASCII `0`–`9`，空值、非数字和类型范围溢出都作为该字段的 `InvalidValue`。输入可使用 LF 或 CRLF 行结束符。

解析成功返回 `Config { timeout_ms, retry_limit }`。失败返回 `ConfigError`，不应将配置原文或非法值放进错误：

- 行号从 1 开始；列号从 1 开始，按 Unicode scalar value（Rust `char`）计数，不按 UTF-8 字节计数。
- 缺少 `=` 时，位置是该行末尾之后、预期 `=` 所在的列。
- 未知字段与重复字段指向字段名的首列；重复错误还指出字段名。
- 无效值指向 `=` 后第一个值字符的位置；空值指向值本应开始的位置。
- 缺失字段指向输入结束处的下一行第 1 列，同时包含缺少的字段名。空输入缺失位置为第 1 行第 1 列。

## 工作步骤

1. 先检查 `src/lib.rs` 与 `tests/public_contract.rs`，运行 `cargo test --offline` 并记录失败测试和实际值。起始实现会用后出现的值覆盖重复字段，重复字段契约应失败；其余公开边界测试应通过。
2. 修复重复字段处理：字段已有值时，返回带字段名和当前位置的 `DuplicateField`，不要覆盖首次值。
3. 检查错误位置：值起始列、缺分隔符列、缺失字段 EOF 位置，以及含多字节字符行的列号都按契约计数。
4. 从原始 ZIP 解压到单独的修复目录，修改副本；保留原始解压目录作为可复现起点。
5. 运行 `cargo fmt -- --check`、`cargo check --offline`、`cargo test --offline`。测试失败必须来自结果断言；修改签名让测试无法编译不算正确修复。
6. 试做一个错误变体：用 `line.len()` 计算 Unicode 列号。多字节 malformed line 的位置测试应检出这个偏差。

## 分层提示

1. **解析结构**：先枚举 `str::lines()` 的行，再以 `split_once('=')` 定位键和值；将 0-based 行序号转为面向用户的 1-based 行号。
2. **数值与上下文**：`parse::<u64>()` / `parse::<u8>()` 给出范围检查；把底层错误转为稳定的字段错误，不保存非法值。
3. **列位置**：`str::len()` 返回字节数；面向本契约的字符列应按 `chars().count()` 计算。
4. **重复项**：`Option` 中已有值说明必填字段已出现；在写入新值前返回 `DuplicateField`。
5. **缺失字段**：解析完毕后检查两个必填项；EOF 的行号是最后一行之后的下一行，空输入从第 1 行开始。

## 快照、版本和重置

实验版本为 `0.1.0`，Rust Edition 为 2024。起始 ZIP 内的 `starter-manifest.json` 为每个起始文件保存 SHA-256；记录 ZIP 自身哈希、课包版本、起始快照哈希、提交内容哈希、评测版本和结果，才能追溯一次尝试。正式环境应由 R2 保存这些记录并执行受控评测。

重置时从 `content/drafts/public/m09-l05-config-parser-starter.zip` 解压至全新目录，在起始包目录运行以下 PowerShell 命令核对文件清单：

```powershell
$manifest = Get-Content starter-manifest.json -Raw | ConvertFrom-Json
foreach ($entry in $manifest.files) {
    $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $entry.path).Hash.ToLowerInvariant()
    if ($actual -ne $entry.sha256) { throw "Hash mismatch: $($entry.path)" }
}
```

保留原始解压副本，再复制到另一个全新目录修复；不要把修复过的目录重新打包成起始 ZIP。此本地流程只证明文件可复现，不替代 R2 隔离器的提交快照、版本绑定和受控重置验收。

## 来源

- [Rust 标准库：`str::lines`](https://doc.rust-lang.org/std/primitive.str.html#method.lines)
- [Rust 标准库：`u64` 的 `FromStr`](https://doc.rust-lang.org/std/primitive.u64.html#impl-FromStr-for-u64)

配置格式、错误类别与契约为原创；官方来源用于核对行迭代和整数解析行为。
