# M17-L01：AppState 与子状态短练习

## 预测：状态生命周期与可见范围

判断 config、连接池、请求中的 user id、TraceId 各自应属于 AppState 还是 request 派生数据。给出 `Router<AppState>` 的含义，并说明何时状态真正提供给完整 Router。

提示：多个请求共享与从某个请求提取是两种生命周期。

## 修复：修正 FromRef 子状态映射

修复 metrics endpoint 返回默认 counter 的问题，使其从启动时注入的 `MetricsState` 读取数据；health handler 仍只读自己的 HealthState，不访问 metrics 字段。

提示：检查 `impl FromRef<AppState> for MetricsState` 的来源字段，再经完整 Router 发请求。

## 实现：按最小状态边界组织 handler

增加一个只需 HealthState 的 `/healthz` handler 与一个只需 MetricsState 的 `/metrics` handler；路由在根级提供 AppState。测试两类 response 的实际值，并保持状态由显式构造参数提供，不引入静态全局。

提示：Router 类型可包含依赖两种子状态的 handlers；FromRef 逐一声明投影。
