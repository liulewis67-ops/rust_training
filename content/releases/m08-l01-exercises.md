# M08-L01 练习：Vec、HashMap 与访问策略

## 1. 预测：访问是否转移所有权

~~~rust
use std::collections::HashMap;

/// Checks non-consuming vector reads and duplicate map insertion.
fn main() {
    let values = vec![String::from("first")];
    let borrowed = values.get(0);
    let missing = values.get(1);

    let mut codes = HashMap::new();
    let first_insert = codes.insert("R4", 7);
    let replacement = codes.insert("R4", 9);
    assert_eq!(borrowed.map(String::as_str), Some("first"));
    assert_eq!(missing, None);
    assert_eq!(first_insert, None);
    assert_eq!(replacement, Some(7));
    assert_eq!(codes.get("R4"), Some(&9));
    assert_eq!(values.len(), 1);
}
~~~

写出 borrowed、missing、first_insert 和 replacement 的值。解释最后一次插入后 map 中的值，以及为什么 values 仍可读取。

**提示**：区分 get 返回的借用与 insert 返回的旧值；注意 get 查找的下标是否存在。

**验证契约**：Rust 1.95.0、Edition 2024 下编译通过。borrowed 是 Some(&values[0])，missing 是 None，first_insert 是 None，replacement 是 Some(7)；map 中 "R4" 对应 9，values 保持可用。

## 2. 修复：外部索引与缺失键

下面的代码在空列表或缺失任务号时可能 panic。改写 task_at 与 owner_for，使这两种情况都由返回值表达；不要克隆任务名，也不要改变传入集合。

~~~rust
use std::collections::HashMap;

/// Reads one task by position.
fn task_at(tasks: &[String], index: usize) -> &String {
    &tasks[index]
}

/// Looks up a task owner by key.
fn owner_for<'a>(owners: &'a HashMap<String, String>, task: &str) -> &'a String {
    &owners[&task.to_owned()]
}
~~~

**提示**：对位置与键分别选择可失败查找 API；用 Option 暴露“可能没有”。借用键可避免为了查询而创建 String。

**验证契约**：正确方案签名返回 Option<&String>，空切片和未命中键返回 None，命中时返回借用值；原索引/map 索引方案在相应输入上 panic，且 task.to_owned() 会额外构造拥有字符串。

## 3. 实现：不复制标签的事件计数

实现 count_events：将 &str 事件标签统计为次数，返回类型为 HashMap<&str, usize>。相同标签累计，空输入返回空 map。用 entry 完成插入或递增，不将键克隆成 String。

~~~rust
use std::collections::HashMap;

/// Counts borrowed event labels without owning copies of their text.
fn count_events<'a>(events: &[&'a str]) -> HashMap<&'a str, usize> {
    // TODO: aggregate labels with the Entry API
    HashMap::new()
}
~~~

**提示**：对每个标签取得 entry；默认次数为 0，再把当前次数加 1。返回 map 中的借用键必须来自输入。

**验证契约**：[] 得到空 map；["warn", "成功", "warn"] 的 warn 次数为 2，成功次数为 1；无多余键克隆。参考实现以 Rust 1.95.0、Edition 2024 编译运行通过。

## 参考答案

1. `get(0)` 是 `Some(&String)`，`get(1)` 是 `None`；首次插入返回 `None`、重复插入返回旧值 `Some(7)`。向量没有被消费。
2. 以借用返回可缺失值，不额外复制键：

   ```rust
   fn task_at(tasks: &[String], index: usize) -> Option<&String> {
       tasks.get(index)
   }

   fn owner_for<'a>(
       owners: &'a std::collections::HashMap<String, String>,
       task: &str,
   ) -> Option<&'a String> {
       owners.get(task)
   }
   ```

3. 以借用的键执行 entry 更新：

   ```rust
   fn count_events<'a>(
       events: &[&'a str],
   ) -> std::collections::HashMap<&'a str, usize> {
       let mut counts = std::collections::HashMap::new();
       for &event in events {
           *counts.entry(event).or_insert(0) += 1;
       }
       counts
   }
   ```

验证重点：空集合与不存在的键均返回 `None`；重复标签累计而非覆盖，返回键的生命周期受输入文本约束。

## 来源

- [The Rust Programming Language](https://doc.rust-lang.org/book/)
