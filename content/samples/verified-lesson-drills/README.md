# Verified Rust lesson drills / 已验证的 Rust 课程样例

该工程只为已发布课程提供可复现的**小型对照实验**，不是 M10 的跨模块项目，也不取代原有 54 节课程的模块实验。

## 运行

使用仓库指定的 Rust 1.95.0 / Edition 2024，从仓库根目录运行：

```sh
cargo +1.95.0 test --offline --manifest-path content/samples/verified-lesson-drills/Cargo.toml --lib
node scripts/verify-lesson-drills.mjs
```

单独检验某个模块（例如 M05）：

```sh
cargo +1.95.0 test --offline --manifest-path content/samples/verified-lesson-drills/Cargo.toml m05::
```

第一条命令只运行可执行正例；第二条同时验证正例和故意失败的 Rust 文件，确保错误确实来自预期的语言规则。**不要把 compile_fail 文件合并到 src 目录**，它们本就应被编译器拒绝。

| Lesson | Passing example | Counterexample | Expected observation |
| --- | --- | --- | --- |
| M01-L04 | src/m01.rs | Behavioral mutation (no compile fail) | True assertions catch constant-output defects |
| M02-L02 | src/m02.rs | compile_fail/m02_tail_semicolon.rs | E0308: i32 vs () |
| M03-L02 | src/m03.rs | compile_fail/m03_missing_variant.rs | E0004: non-exhaustive match |
| M04-L03 | src/m04.rs | compile_fail/m04_used_after_move.rs | E0382: use after move |
| M05-L02 | src/m05.rs | compile_fail/m05_borrow_after_push.rs | E0502: overlapping borrow |
| M06-L02 | src/m06.rs | compile_fail/m06_ambiguous_result.rs | E0106: missing lifetime relation |
| M07-L02 | src/m07.rs | compile_fail/m07_wrong_associated_output.rs | E0053: incompatible trait implementation |
| M08-L04 | src/m08.rs | Behavioral mutation (no compile fail) | Lazy adapter is not evaluated until consumed |
| M09-L02 | src/m09.rs | Behavioral mutation (no compile fail) | Missing source breaks structured error assertions |

## Teaching protocol / 教学要求

1. **Predict** the return value, error category, or compiler diagnostic before execution.
2. **Observe** a passing example. Read the assertions, including the empty and boundary cases.
3. **Contrast** a deliberately invalid program or a behavioral mutation. Record whether it fails to compile or fails an assertion; those are not the same.
4. **Repair** your own copy without deleting the assertion, weakening the API contract, or adding indiscriminate clone calls.
5. **Transfer** the rule to the fourth exercise on the Chinese/English course exercise page.
6. **Reflect** on why the failure occurs and which alternative design best matches the actual requirement.

## Verification boundaries

- The test harness verifies **actual behavior** and the presence of expected compiler error codes; it does not claim a full rustc diagnostic is byte-for-byte stable.
- Syntax examples for the nine selected lessons are deliberately small; more advanced Rust behavior continues to be taught in their original lessons and project exercises.
- Do not translate or independently change Rust source in one language edition of the course. Chinese and English lesson pages link to the exact same tested code.
