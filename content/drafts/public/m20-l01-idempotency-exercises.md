# M20-L01：三道短练习

三题按“预测 → 修复 → 实现”递进。每题都按公开合同判定，答案和隐藏评分留在 private assessment。

## 1. 预测：键作用域与结果重放

**契约**：作用域为 `(authenticated_user_id, operation, key)`；相同作用域、相同请求指纹应返回先前 task；相同作用域但不同指纹返回 409 `idempotency_conflict`；其他用户可合法使用相同 key。

依次预测下面请求是否创建任务、响应 task ID 是否相同、是否冲突：

1. user 11, `create-task`, key `k-4`, project 7, title `整理日志`（首次）；
2. user 11, `create-task`, key `k-4`, project 7, title `整理日志`（重试）；
3. user 11, `create-task`, key `k-4`, project 7, title `修复构建`；
4. user 12, `create-task`, key `k-4`, project 7, title `修复构建`。

**提示**：先检查身份与 operation 是否相同，再比较规范化请求指纹；重试要检查持久状态而非只看 HTTP status。

**验证合同**：四步结束时总共只为 user 11 创建一个任务；第 2 步返回第 1 步 task ID，第 3 步为 409 且不改状态，第 4 步可成功创建另一个任务。

## 2. 修复：键校验不能代替键查重

**错误代码**：

```rust
fn create_task(state: &mut State, user_id: UserId, key: &str, input: Input) -> Result<Task, Error> {
    validate_key(key)?;
    let task = state.insert_task(input)?;
    state.idempotency.insert((user_id, key.to_owned()), task.id);
    Ok(task)
}
```

**契约**：保持函数签名和 task API；先查 `(user_id, operation, key)` 的既有记录，比较请求指纹。同指纹回放原 task，不同指纹返回冲突。首次请求才创建 task 并绑定 replay 结果。不能删除或改弱调用方测试。

**提示**：记录必须能比较首次输入；只存 task ID 不足以判断同键异参。把“检查已存在”和“创建并保存结果”作为同一个原子步骤来设计。

**验证合同**：同键同输入只得到一个 task ID；同键不同标题返回冲突且 task 数不变；不同 user 可复用 key；空 key 在写状态前被拒绝。

## 3. 实现：并发与原子写入

为下列伪代码补充缺失的并发安全步骤，并用文字或 Rust/SQL 片段说明事务范围：

```text
existing = find_idempotency(scope, key)
if existing is none:
    task = insert_task(project, title)
    save_idempotency(scope, key, fingerprint, task.id)
    commit
```

**契约**：两个并发、相同作用域与相同指纹的请求只能创建一个 task；赢家返回 201，另一请求在赢家提交后重放同一个 task；不同指纹不能被静默重放；任务插入或 replay 记录保存任何一步失败时不得留下半完成结果；每次尝试重放都重新检查当前 project membership。

**提示**：用 `(user_id, operation, key)` 唯一约束协调竞争，并把授权、reservation、task 和 replay target 放进同一事务。唯一冲突后重新读取并比较 fingerprint。不要以进程内 Mutex 声称跨实例安全。

**验证合同**：并发屏障同时放行两个相同请求，最终 task 数为 1，两个响应的 task ID 相同；跨用户可各自创建；注入 task/event/replay 写失败后数据库中相关写入全部回滚；撤销成员关系后重放请求仍按授权合同拒绝。
