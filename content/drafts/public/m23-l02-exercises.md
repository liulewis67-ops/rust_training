# M23-L02 三道短练习

## 预测：估计 clone 会复制什么

输入固定为 10,000 个 `Record { id, category, label }`；恰有 2,500 个记录命中，命中 label 平均 32 UTF-8 bytes。当前函数返回 `Vec<String>` 并对每个命中项执行 `label.clone()`；候选接口返回 `Vec<&str>`。指出两种结果集合的元素存储、至少哪些动态存储会被复制/保留，以及为什么不能只凭这些静态信息宣称耗时提高了多少。

**契约：**计算已知匹配文本复制量的下界（不含 allocator 元数据/容量），指出两个版本仍可能为结果 Vec 分配；提出一条行为不变和一条本机测量比较方式。

**提示：**UTF-8 byte 长度已给定；被借用的文本留在输入 `Record` 中。不要把引用结果说成“完全无分配”。

## 修复：不为只读比较 clone

修复 starter 的 `has_match(records, expected_label)`：保持 true/false 结果、大小写和精确匹配语义，用借用的 `&str` 比较，不创建临时 `String`。不得改动 fixture 或绕过 public tests。

**公开检查：**首项命中、中间项命中、无命中、不同大小写和空切片。测试结果一致证明语义合同；源码检查确认不在搜索路径 clone label。

**提示：**匹配只需要比较字符串内容；`String::as_str()` 能提供 borrowed view。

## 实现：直接编码 JSON bytes

实现 `encode_json_direct(records)`，返回 `serde_json::to_vec` 的 JSON bytes。与 `encode_json_via_string` 输出逐字节相同；支持 Unicode、需要 escaping 的字符串和空输入，向上传播 serializer 错误。

**公开检查：**简单数组/对象字段、中文和双引号 escaping、空记录列表的 bytes 与参考 JSON 一致，输出 bytes 可反序列化回相同 records。

**提示：**输出 contracts 相同后，Criterion harness 已放好四条路径。数据构造在计时闭包外，输入和输出用 `std::hint::black_box`；本地样本仍不是 R2/R3 结果。
