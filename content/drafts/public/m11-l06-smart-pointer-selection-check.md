# M11-L06 独立检查：根据约束选择最简单的持有方式

## 检查方式

这是 M11 的独立检查，不是新的概念讲解。请从全新提交中完成代码和设计说明；提交前不要查看教师参考。任务绑定本课版本和起始快照。完成后可查看逐条契约反馈并继续训练；只有答案未公开前的独立提交能产生独立技能证据。

## 陌生情境：构建任务服务

构建服务接收调用方提供的标签，编译一份递归表达式树，允许本地调度器和审计器共享同一策略，并把只读策略交给后台 worker。现在没有跨线程写操作，也不要求节点在父对象释放后继续存活。

给定以下未完成接口：

```rust
use std::sync::Arc;
use std::thread::JoinHandle;

pub enum Expr {
    Literal(i64),
    Add(/* fill child ownership */),
}

pub struct Policy {
    pub max_retries: u8,
}

pub fn render_label(input: &str) -> String {
    todo!()
}

pub fn sum(expr: &Expr) -> i64 {
    todo!()
}

pub fn local_views(policy: /* choose type */) -> (/* choose types */) {
    todo!()
}

pub fn worker(policy: Arc<Policy>) -> JoinHandle<u8> {
    todo!()
}
```

## 交付任务

1. 补全 Add 两个子表达式的持有类型与 `sum(&Expr)`，允许树递归且每个子节点只有一个父拥有者。
2. 实现 `render_label`：输入仅在函数期间借用；输出必须独立拥有清洗后的字符串。不要复制输入后再借用。
3. 为同线程调度器和审计器共享只读 Policy 实现 `local_views`；两份 handle 应指向同一份分配，不复制 Policy。解释为什么这一情境不用 Arc、RefCell 或 Mutex。
4. 实现 `worker`，后台线程只读 Policy 并返回 max_retries；主线程传入的 Arc 仍能继续使用。代码必须通过 `thread::spawn` 的线程边界。
5. 用表格总结每个选择依据，并回答：如果 worker 改为和其它线程共同修改重试预算，类型边界需要怎样改变；如果节点需要回指父节点但不拥有父节点，又应选择哪种关系边。

## 可见契约

- 表达式由嵌套 `Add` 构成时 sum 正确；叶子值可正、负或零。
- render_label 将首尾空白去除，并返回与输入生命周期无关的 owned String。
- local_views 的两个 handle 可同时读取同一个 Policy allocation；Policy 不要求实现 Clone。
- worker 返回配置值；join 后原 Arc 仍可读取。
- 不引入第三方 crate、全局可变状态、`unsafe` 或无必要的嵌套智能指针。

## 验证与提交记录

独立环境会在保留旧行为的同时运行多组隐藏输入，包括深度不同的表达式、临时 String 输入、非 Clone Policy、真实 worker 线程以及不合法的跨线程 Rc/RefCell 变体。记录课包版本、起始快照、答案提交哈希和评测版本。查看参考答案后可以继续训练，但该次结果不计独立技能证据。
