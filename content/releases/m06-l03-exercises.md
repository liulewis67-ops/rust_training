# M06-L03 练习：借用结构体与拥有型返回值

## 1. 预测：视图和输入 owner

```rust
struct TagView<'source> {
    name: &'source str,
    value: &'source str,
}

fn parse_tag(text: &str) -> Option<TagView<'_>> {
    let (name, value) = text.split_once('=')?;
    Some(TagView { name, value })
}

fn main() {
    let raw = String::from("region=west");
    let view = parse_tag(&raw).unwrap();
    println!("{}:{}", view.name, view.value);
    println!("{}", raw.len());
}
```

预测能否编译和输出，并说明 `view` 与 `raw` 分别持有什么。

**提示**：切片字段借用输入；引用读取和 owner 读取都发生在 owner 作用域结束之前。

**验证契约**：编译运行，输出 `region:west` 和 `11`。解释要指出结构体保存引用，调用方仍拥有并需保留 `raw`。

## 2. 修复：选择要返回的持有责任

下面的 API 在函数内建造输入，并试图返回指向局部文本的视图。改写成返回可独立持有的结果，保留 code 与 detail 两个字段和其内容。

```rust
struct AlertView<'source> {
    code: &'source str,
    detail: &'source str,
}

fn build_alert() -> AlertView<'static> {
    let raw = String::from("R20|worker restarted");
    let (code, detail) = raw.split_once('|').unwrap();
    AlertView { code, detail }
}
```

**提示**：改变生命周期标注不能让局部 `raw` 活过函数。要让结果逃逸，返回值需要拥有字段文本。

**验证契约**：改为 `Alert { code: String, detail: String }` 并在返回前构造两个拥有型字段；调用方可在函数返回后分别读取 `R20` 与 `worker restarted`。不得返回局部切片或只删去一个字段。

## 3. 补全测试：验证两种 API 的契约

为 `parse_alert_view` 和 `parse_alert_owned` 补全测试。至少覆盖正常输入、分隔符缺失、空字段、首个分隔符语义；另加一项证明借用字段位于输入字节范围内，以及一项证明拥有型结果能在输入离开作用域后使用。

```rust
#[test]
fn parse_alert_view_contract() {
    // TODO: Assert parsed fields, missing delimiter, empty fields, and slice provenance.
}

#[test]
fn parse_alert_owned_contract() {
    // TODO: Keep the result after a temporary input is dropped and assert its fields.
}
```

**提示**：`str::split_once` 只处理第一次分隔；指针范围用源 `String` 的首地址和长度检查。拥有型结果放在创建输入的内层块之外读取。

**验证契约**：两项测试均通过；视图版切片指针位于输入地址范围，拥有版输入销毁后仍能访问两个字段。错误测试不可只核对示例而忽略返回值和输入持有关系。

最后简述两种 API 对调用方生命周期和字符串分配成本的不同要求。

## 参考答案

1. 输出依次为 `region:west` 和 `11`。`view` 持有 `raw` 的两个切片，调用方仍持有 `raw`；`11` 是输入的 UTF-8 字节数。
2. 定义拥有型结构体，并复制字段切片：

   ```rust
   struct Alert { code: String, detail: String }

   fn build_alert() -> Alert {
       let raw = String::from("R20|worker restarted");
       let (code, detail) = raw.split_once('|').unwrap();
       Alert { code: code.to_owned(), detail: detail.to_owned() }
   }
   ```

   返回字段独立拥有文本，所以 `raw` 销毁后仍能读取两个字段。
3. 参考测试如下；假定使用课文中的解析函数：

   ```rust
   #[test]
   fn parse_alert_view_contract() {
       let raw = String::from("A17|延迟|稍后");
       let view = parse_alert_view(&raw).unwrap();
       assert_eq!((view.code, view.detail), ("A17", "延迟|稍后"));
       assert_eq!(parse_alert_view("missing"), None);
       assert_eq!(parse_alert_view("|detail").unwrap().code, "");
       let start = raw.as_ptr() as usize;
       let end = start + raw.len();
       for part in [view.code, view.detail] {
           let part_start = part.as_ptr() as usize;
           assert!((start..=end).contains(&part_start));
           assert!(part_start + part.len() <= end);
       }
   }

   #[test]
   fn parse_alert_owned_contract() {
       let alert = {
           let raw = String::from("A18|cache rebuilt");
           parse_alert_owned(&raw).unwrap()
       };
       assert_eq!((alert.code.as_str(), alert.detail.as_str()), ("A18", "cache rebuilt"));
       assert_eq!(parse_alert_owned("missing"), None);
       assert_eq!(parse_alert_owned("code|").unwrap().detail, "");
   }
   ```

   视图零复制但要求调用方保留输入；拥有型结果复制并分配字段，可在输入结束后继续使用。