# M17-L04：接口分层与依赖替身短练习

## 修复：接通注入的 Store

查找 app/store State 初始化路径，修复绕过入参、内部硬编码 MemoryStore 的实现。保留现有 HTTP 错误/成功契约。

提示：从 app 的 store 参数一直追到 show_user 实际读取的 trait object。

## 实现：独特替身与 Router 验证

实现 UserStore 替身，为默认样例不存在的 ID 77 返回 Injected；通过完整 Router 请求断言 status 与 JSON。

提示：替身只需实现 handler 所需的一种行为。检查 response 是否来自替身而不是默认 MemoryStore。

## 设计评审：接口是否值得存在

针对同步纯内存 UserStore 说明接口边界、Arc<dyn UserStore> 的注入时机、替换测试证明和真实异步 DB 的后续设计事项。

提示：回答这个抽象隔离了什么具体变化，并明确它没有解决什么。
