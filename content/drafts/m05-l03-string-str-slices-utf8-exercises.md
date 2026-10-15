# M05-L03 三道短练习草案

状态：课前草稿；依赖 M05-L02，尚未经过 R1、平台或独立学习者验收。

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
