# M05-L03：字符串切片与 UTF-8 练习

先完成每题，再展开文末的公开参考答案。依赖 M05-L02。

## 1. 预测：找到原文本的第一段

~~~rust
/// Shows results for empty, Chinese, and Unicode-whitespace inputs.
fn main() {
    /// Returns the first whitespace-delimited slice of its input.
    fn first_token(text: &str) -> &str {
        text.split_whitespace().next().unwrap_or("")
    }

    println!("{:?}", first_token(""));
    println!("{}", first_token("中文　Rust"));
    println!("{}", first_token("alpha\u{2009}beta"));
}
~~~

写出三行输出；说明中文 token 的字节长度为何不等于字符数，并指出每个非空返回值来自哪段输入。

**契约：** 输出 ""、中文、alpha；指出 first_token 返回原输入的 &str 子切片。U+3000 与 U+2009 都按 Unicode 空白分隔。

**分层提示：** ① 空迭代器时 unwrap_or 返回什么？② split_whitespace 识别哪类分隔符？③ 返回 token 是新字符串还是原输入切片？

## 2. 修复：不能返回局部字符串的切片

~~~rust
/// Prints the token borrowed from an input string.
fn main() {
    /// Tries to return a token from a local owned String.
    fn first_token(text: &str) -> &str {
        let owned = String::from(text);
        owned.split_whitespace().next().unwrap_or("")
    }

    let input = String::from("deploy now");
    println!("{}", first_token(&input));
}
~~~

当前实现因返回局部变量的引用而触发 E0515。修复 first_token，保留函数签名，并令输入 "deploy now" 返回 "deploy"，空输入返回 ""。解释修复后的切片为何不会悬空。

**契约：** 正确版编译，返回值来自输入文本；不得改为返回 String、不得硬编码示例或删掉调用步骤。教师侧另检查中文与 Unicode 空白变式。

**分层提示：** ① owned 在何时销毁？② 输出切片应从哪个仍有效的输入生成？③ 直接在 text 上调用 split_whitespace。

## 3. 实现：返回 UTF-8 安全的首 token

补全 first_token，返回首个 Unicode 空白分隔片段；空文本或全空白文本返回空切片。

~~~rust
/// Checks common ASCII and Unicode inputs.
fn main() {
    /// Returns a slice of the first token, or an empty slice when no token exists.
    fn first_token(text: &str) -> &str {
        // TODO: Return the first Unicode-whitespace-delimited slice.
        todo!()
    }

    assert_eq!(first_token(""), "");
    assert_eq!(first_token("　\t"), "");
    assert_eq!(first_token("你好 世界"), "你好");
    assert_eq!(first_token("alpha\u{2009}beta"), "alpha");
}
~~~

**契约：** 全部断言通过；函数返回从 text 借用的切片，不分配新文本、不硬编码、不过度截取字节区间、不使用 unsafe。

**分层提示：** ① 输入类型已经是字符串切片。② 通过迭代器处理 Unicode 空白并读取第一个结果。③ 无结果时使用空字符串切片。

## 4. 边界迁移：UTF-8 字节边界与运行时 panic

预测 ASCII、中文及 U+3000 分隔输入的首 token，运行三个测试。分别通过 `get(..3)` 与 `get(..1)` 访问中文文本，再在独立副本中直接切片到字节 1，解释何者是 `None`、何者 panic；不要把字节数当字符数。

**验收：** 执行 `cargo +1.95.0 test --offline --manifest-path content/samples/verified-lesson-drills/Cargo.toml m05_utf8::`、记录正例与反例的具体观察，并说明采用这个修复而非隐藏错误的原因。

## 参考答案

1. 输出依次为 `""`、`中文`、`alpha`。中文 token 是原输入的切片，两个汉字占 6 个 UTF-8 字节。U+3000 和 U+2009 都是 Unicode 空白。
2. 不要在函数里创建局部 `String`；直接从输入切片取 token：

   ```rust
   fn first_token(text: &str) -> &str {
       text.split_whitespace().next().unwrap_or("")
   }
   ```

   返回片段借用调用方输入，不指向函数返回时会销毁的局部 owner。
3. 与第 2 题相同的实现满足所有断言；它不分配文本，空或全空白输入返回空字符串切片。
