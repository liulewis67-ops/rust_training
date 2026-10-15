# M10-L02 短练习：单元、集成与文档测试

## 1. 预测：哪些位置能看到私有项？

ProfileName 和 name 模块均为私有；profile_core crate root 只公开重导出 render_profile_report 与 ProfileNameError。预测以下三处各自能否访问 ProfileName::parse：

1. src/name.rs 内 #[cfg(test)] mod tests；
2. tests/public_contract.rs；
3. render_profile_report 的 doctest。

分别说明它们编译/访问能力的原因。不要假设改成 pub 是正确修复。

**分层提示**

1. 先判断代码属于 profile_core crate 还是外部测试 crate。
2. 子模块能沿模块树访问什么？外部 crate 的入口是什么？

## 2. 修复：把私有测试放回正确边界

某同学在 profile-core/tests/private_name.rs 写道：

~~~rust
use profile_core::name::ProfileName;

#[test]
fn trims_before_storing() {
    let name = ProfileName::parse(" user_7 ").unwrap();
    assert_eq!(name.0, "user_7");
}
~~~

Cargo 因 name 模块不可见而拒绝编译。请给出最小、符合测试边界的修复方案，并说明是否应公开 name、ProfileName 或字段 .0。

**分层提示**

1. 这项断言想检查私有表示还是调用者契约？
2. 把 #[cfg(test)] mod tests 放到 name.rs，用模块内可见路径检查不变量。
3. 外部测试应改为断言 render_profile_report 的公开结果。

## 3. 实现：为 trim 回归建立三层检查

补充一组针对“名称两端空白会被去除”的测试：

- 在 name.rs 写单元测试，断言解析后私有名称为 training_user；
- 在 tests/public_contract.rs 写集成测试，断言输入 " training_user " 返回 Ok("profile=training_user")；
- 在公开函数 doctest 中展示同一结果，并断言 "bad name" 返回 ProfileNameError::InvalidCharacters。

写出各测试所在文件以及分别运行它们的 Cargo 命令。说明把 let trimmed = raw.trim(); 改成 let trimmed = raw; 后，哪些行为断言会失败。只接受正确实现，不要求扩大任何可见性。

**分层提示**

1. 单元测试放入紧邻解析器的 test 子模块，并只在测试构建时启用。
2. 集成测试和 doctest 都只导入 crate root 的公开项目。
3. 为返回值写 assert_eq!，再分别使用 --lib、--test、--doc 运行。
