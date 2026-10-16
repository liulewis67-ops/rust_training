# M02-L05 起始项目：整分钟转秒

此 Cargo 库把十进制整分钟文本转换为秒。课程题面与完整契约请查看网站中的 M02-L05；本 README 说明如何在本地运行起始项目。

## 契约

- 接受无符号的十进制整分钟文本，精确乘以 60，不做舍入。
- `"0"` 是合法输入，转换结果为 `Ok(0)`。
- 空值、非数字、负数、超出 `u64` 的文本，以及乘法溢出的值都必须返回 `Err`。
- 函数对任何文本都不得 panic。

## 复现步骤

```powershell
rustc --version
cargo --version
cargo check
cargo test
cargo fmt -- --check
```

起始 `cargo check` 按设计会因源文件中的类型错误失败。修正后继续运行公开契约测试；项目中存在后续行为缺陷。保留 `tests/public_contract.rs` 原样，以便它继续检查转换契约。

## 快照

- Starter version: `0.1.0`
- Course unit: `M02-L05`
- Archive manifest: `starter-manifest.json`（随 ZIP 一并提供）
- Reset: 保留此起始 ZIP；要重新开始，请在新的空目录解压，不要用修复后的目录覆盖快照。
