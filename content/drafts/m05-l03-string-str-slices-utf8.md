# M05-L03：String、str、切片与 UTF-8

## 学完后

- 区分拥有 UTF-8 内容的 String 与借用字符串切片 &str。
- 通过 &str 接收文本，并返回指向输入内容的子切片，而不创建指向局部 String 的悬空引用。
- 使用支持 Unicode 空白的 split_whitespace 查找第一个 token，正确处理空文本、中文和非 ASCII 分隔符。
- 解释字符串切片索引是字节偏移且必须落在 UTF-8 字符边界。

## 先修

完成 M05-L02，能判断共享引用何时仍会使用。本节将 &str 当作输入文本的只读切片；返回 token 时借用调用方提供的文本，不讨论手写命名生命周期或不安全字节转换。

## String 拥有内容，str 借用内容

~~~rust
/// Keeps ownership of a String after passing a borrowed view.
fn main() {
    /// Reads a borrowed string slice without taking ownership.
    fn describe(text: &str) {
        println!("text: {text}; bytes: {}", text.len());
    }

    let title = String::from("你好");
    describe(&title);
    println!("owner: {title}");
}
~~~

输出为 text: 你好; bytes: 6、owner: 你好。title 是拥有 UTF-8 字节内容的 String；传给 describe 的 &title 是借用视图，不转移 owner。&str 可指向 String 的全部内容、部分内容或字符串字面量；它本身不拥有那段文本。

str::len() 统计 UTF-8 字节数，不是 Unicode 标量值个数或用户眼中的字符数。因此两个汉字 你好 在 UTF-8 中占 6 字节。切片长度和下标也使用字节偏移。

## 返回输入中的第一个 token

用 split_whitespace 可按 Unicode White_Space 属性分隔文本。迭代器产生的 &str 都是原输入的子切片；没有 token 时返回空切片：

~~~rust
/// Exercises first_token on ASCII, Chinese, Unicode whitespace, and empty text.
fn main() {
    /// Returns the first Unicode-whitespace-delimited token from the input slice.
    fn first_token(text: &str) -> &str {
        text.split_whitespace().next().unwrap_or("")
    }

    println!("ascii: {}", first_token("  build tools  "));
    println!("chinese: {}", first_token("你好 世界"));
    println!("unicode space: {}", first_token("  rust\u{3000}课程"));
    println!("empty: {:?}", first_token(""));
}
~~~

输出为 ascii: build、chinese: 你好、unicode space: rust、empty: ""。U+3000 IDEOGRAPHIC SPACE 属于 Unicode 空白；只按 ASCII 空白切割不能满足这个例子。没有 token 时 unwrap_or("") 返回静态空字符串切片，不会 panic。

返回类型写 &str 而不创建新 String：结果直接借用 text 的字节区间，调用方必须让原文本保持可用到该结果最后一次使用。函数的省略生命周期规则会把输出引用关联到唯一的输入引用；不必为这个简单签名手写生命周期标注。

## 为什么不能返回局部字符串的引用

~~~rust
/// Tries to return a slice into a local String.
fn invalid_token(text: &str) -> &str {
    let owned = String::from(text);
    owned.split_whitespace().next().unwrap_or("")
}
~~~

owned 在函数返回时离开作用域并被销毁。若结果指向 owned 的缓冲区，调用者拿到的引用就会悬空；Rust 因此以 E0515 拒绝返回局部变量的引用。正确的 first_token 直接从输入 text 得到子切片，输入 owner 的生命周期由调用方管理。

也不能随意使用 &text[0..n] 按字节截取字符。比如 你好 的首个汉字占多个 UTF-8 字节；若 n 落在字符编码中间，运行时会 panic。优先使用按字符边界工作的文本操作（如 split_whitespace），只有已验证边界的字节偏移才能用于字符串切片。

## 检查顺序

1. 确认函数需要拥有输入文本，还是只需用 &str 查看它。
2. 确认返回的 &str 是输入的切片还是局部临时值的切片。
3. 对 token/分隔符使用符合契约的 Unicode 空白规则；空输入应有明确定义。
4. 如果手动按字节下标切片，先确认起止位置是 UTF-8 字符边界；不确定时改用字符串迭代器。
5. 对返回切片继续使用的代码，确保其来源输入仍然可用。

## 来源

- [The Rust Programming Language：The Slice Type](https://doc.rust-lang.org/book/ch04-03-slices.html)
- [The Rust Programming Language：Storing UTF-8 Encoded Text with Strings](https://doc.rust-lang.org/book/ch08-02-strings.html)
- [Rust standard library：str::split_whitespace](https://doc.rust-lang.org/std/primitive.str.html#method.split_whitespace)
- [Rust standard library：str::len](https://doc.rust-lang.org/std/primitive.str.html#method.len)

正文、案例、token 契约和图示为原创；来源用于核对切片借用、UTF-8 字节边界、Unicode 空白和长度单位。
