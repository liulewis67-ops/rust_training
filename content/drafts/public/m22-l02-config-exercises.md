# M22-L02：三道短练习

## 1. 预测：凭据会出现在哪里？

团队在 `build.rs` 中用 `env!("APP_API_TOKEN")` 生成常量；上线后支持包会上传二进制。说明这个 token 是否会随 executable 发布，并给出运行时配置的替代路径。

**契约**：区分编译期和运行期读取；提出适用于普通设置和秘密的交付方式；不得把秘密移到另一个会进入镜像层的 Docker `ARG`。

## 2. 修复：启动时泄密且静默降级

给定解析器对缺失的 `DATABASE_URL` 使用 `postgres://demo:demo@localhost/app`，对非法 `BIND_ADDR` 打印原始输入，并 derive `Debug` 的配置含明文 `API_TOKEN`。修复为缺必需值快速失败、绑定地址校验、稳定脱敏错误，并将 token 从受控 secret file 读取。

**提示**：`_FILE` 只是路径变量，不自动证明文件挂载安全；错误和 Debug 输出中也不能出现合成 sentinel。

## 3. 实现：可独立测试的配置解析

完成 starter `parse_config(settings, token_file_contents)`，读取必需的 database URL 与 bind address、验证空值/地址、接受 token file 内容并返回配置；对配置与错误执行 Debug/Display 后断言 sentinel 不存在。

**契约**：解析器通过显式输入 map 测试，不修改进程全局环境；secret 的 `Debug` 脱敏；缺失/空值不产生 credential 默认值。
