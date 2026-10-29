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

## Second verification wave / 第二轮边界测试

这组测试额外覆盖 M01–M09 的九节不同课时，不重复上一轮的代表性课程。所有失败样例是**明确标为预期失败的学习素材**，不要与运行时边界测试混淆。

| Lesson | Positive Rust module | Negative demonstration | Evidence |
| --- | --- | --- | --- |
| M01-L03 | src/m01_diagnostics.rs | compile_fail/m01_diagnostic_type.rs | E0308 vs Err vs expected runtime panic |
| M02-L04 | src/m02_shapes.rs | Runtime bounds panic | get returns None at index==len |
| M03-L03 | src/m03_missing.rs | Incorrect absent-as-empty model | Some(\"\") is not None |
| M04-L04 | src/m04_partial.rs | compile_fail/m04_partial_move.rs | E0382 after moving a field |
| M05-L03 | src/m05_utf8.rs | Runtime invalid UTF-8 slice panic | byte 1 is not a char boundary |
| M06-L04 | src/m06_static.rs | compile_fail/m06_nonstatic_borrow.rs | E0597 vs owned type with immediate Drop |
| M07-L04 | src/m07_conversion.rs | compile_fail/m07_mixed_newtypes.rs | E0308, plus TryFrom checked range |
| M08-L03 | src/m08_iteration.rs | compile_fail/m08_after_into_iter.rs | E0382 after consuming an owned Vec |
| M09-L01 | src/m09_propagation.rs | compile_fail/m09_incompatible_question.rs | E0277 when ? cannot convert error |

Run the same commands from the repository root; the CI verifier now checks **both waves** of passing examples and expected compilation diagnostics. For a single second-wave lesson, use a module filter, such as `cargo +1.95.0 test --offline --manifest-path content/samples/verified-lesson-drills/Cargo.toml m05_utf8::`.

## Third verification wave / 第三轮深入验证

第三批覆盖另外九节课程，使用独立的 Rust 测试和预期编译错误验证工具链、控制流、类型封装、资源析构、借用接口、引用与拥有型结果、动态分发、闭包和错误边界。

| Lesson | Executable source | Counterexample | Expected evidence |
| --- | --- | --- | --- |
| M01-L02 | src/m01_toolchain.rs | Confusing toolchain, package version and Edition | Two tests; Cargo metadata confirms Edition 2024 and version 0.1.0 |
| M02-L03 | src/m02_control.rs | compile_fail/m02_if_branch_type.rs | E0308; separate runtime bound assertions |
| M03-L04 | src/m03_visibility.rs | compile_fail/m03_private_state.rs | E0616 when a sibling reads a private field |
| M04-L01 | src/m04_scope.rs | compile_fail/m04_direct_drop.rs | E0040; reverse drop order and one explicit drop |
| M05-L04 | src/m05_api.rs | compile_fail/m05_view_across_push.rs | E0502; empty input remains unchanged |
| M06-L03 | src/m06_views.rs | compile_fail/m06_view_of_local.rs | E0515; owned result outlives temporary source |
| M07-L03 | src/m07_dispatch.rs | compile_fail/m07_nondyn_trait.rs | E0038 for non-dyn-compatible trait |
| M08-L02 | src/m08_closures.rs | compile_fail/m08_fnmut_not_fn.rs | E0525; Fn vs FnMut vs FnOnce |
| M09-L03 | src/m09_boundaries.rs | Wrong mapping or leaking storage details | Correct 400/404/500 and no private cause in response |

**Run:** `node scripts/verify-lesson-drills.mjs` from the repository root. The verification script reads Cargo metadata and checks all runnable tests and deliberately rejected files. You can isolate one lesson with `cargo +1.95.0 test --offline --manifest-path content/samples/verified-lesson-drills/Cargo.toml m07_dispatch::`. Expected runtime panic tests are identified with `#[should_panic]`, so they are not mistaken for unhandled failures.

## Teaching protocol / 教学要求

1. **Predict** the return value, error category, or compiler diagnostic before execution.
2. **Observe** a passing example. Read the assertions, including the empty and boundary cases.
3. **Contrast** a deliberately invalid program or a behavioral mutation. Record whether it fails to compile or fails an assertion; those are not the same.
4. **Repair** your own copy without deleting the assertion, weakening the API contract, or adding indiscriminate clone calls.
5. **Transfer** the rule to the fourth exercise on the Chinese/English course exercise page.
6. **Reflect** on why the failure occurs and which alternative design best matches the actual requirement.

## Verification boundaries

- The test harness verifies **actual behavior** and the presence of expected compiler error codes; it does not claim a full rustc diagnostic is byte-for-byte stable.
- The verified examples for the selected lessons are deliberately small; more advanced Rust behavior continues to be taught in their original lessons and project exercises.
- Do not translate or independently change Rust source in one language edition of the course. Chinese and English lesson pages link to the exact same tested code.
