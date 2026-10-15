# M16-L03：Path/Query/Json 短练习

## 预测：参数提取与 rejection 矩阵

对 `GET /tasks/42?page=3`、`GET /tasks/nope?page=3`、`GET /tasks/42?page=x` 和带合法 JSON 的 `POST /tasks/42/labels` 写出 handler 是否运行、输入值以及默认 rejection 结果。说明 `Path<u64>` 与领域层拿到一个错误值有什么区别。

提示：Extractor 按参数从左到右执行；解析失败时不会进入 handler。

## 修复：分页默认值与 JSON 输入

修正 `PageQuery` 的默认 page，使 query 缺省时从 1 开始，显式 page=3 保持 3。保持 Path、Query 在 Json 之前；不得为了解析 page 而重复消费 body。

提示：默认值在可选 query 完成解码后设定；请求 body 不参与 URL query 解码。

## 实现：合法/非法请求与顺序编译门槛

完善集成测试：验证 path id 和 query page 到达 handler；非数字 path/query、非法 JSON 得到提取拒绝；有效 JSON 得到结构化 response。添加一个 `compile_fail` handler 反例，证明 body-consuming Json 不能排在另一 extractor 前或重复出现。

提示：将 syntax/deserialize rejection 与 handler 内领域错误分开断言；编译失败代码段要尽可能最小化。
