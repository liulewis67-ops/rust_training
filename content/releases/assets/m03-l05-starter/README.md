# M03-L05 起始项目：内存任务清单

这是一个只在内存中保存任务的 Cargo 库。请先阅读 rust.path 网站中的 M03-L05「内存任务清单」课程，再查看 `tests/public_contract.rs` 并运行检查。

## 契约摘要

- `TaskList::new()` 建立空列表；`add_task` 从编号 1 开始递增并返回新编号。
- `get` 对已有编号返回 `Some(&Task)`；不存在时返回 `None`。
- 状态只接受大小写敏感的 `todo`、`doing`、`done`。
- `set_status` 区分 `Updated`、`TaskNotFound` 和 `InvalidStatus`。先解析状态文本；非法文本不会修改任务。
- 任务的字段保持私有，通过只读方法读取编号、标题和状态。
- 项目无文件持久化、网络访问或第三方依赖。

## 复现步骤

```powershell
rustc --version
cargo --version
cargo check --offline
cargo test --offline
cargo fmt -- --check
```

起始 `cargo check` 按设计会因 `parse_status` 的返回类型错误而失败。修正后继续运行测试；`get` 当前仍不完整。不要修改或删除公开测试来获得通过结果。所有命令都在本地执行；项目不联网、不上传数据。所有命令都在本地执行；项目不联网、不上传数据。

## 快照

- Starter version: `0.1.0`
- Course unit: `M03-L05`
- Archive manifest: `starter-manifest.json`
- Reset: 保留此 ZIP；重新开始时解压到新的空目录，并核对清单哈希。
