# rust.path

面向开发者的免费开源 Rust 工程学习路线。课程在浏览器中阅读，代码练习和项目在你的电脑上完成；网站不要求注册，也不提供在线运行服务。

## 开始学习

```sh
pnpm install
pnpm dev
```

需要 Node.js `22.19.x` 和 `pnpm@11.1.3`。打开终端显示的本地地址，浏览课程目录，按课程说明复制代码或下载项目模板，再用本机 Rust 工具链运行和测试。

## 构建

```sh
pnpm build
pnpm preview
```

构建产物输出到 `dist/`。`pnpm build` 默认用于网站根路径；GitHub Pages 项目站构建需要设置 `PAGES_BASE_PATH=/rust_training/`。

## 学习记录

阅读位置、练习和完成标记可保存在当前浏览器的 `localStorage`。这些记录不会上传到服务器，也不会跨设备同步。浏览器禁用本地存储时，课程仍可使用，但刷新后进度不会保留。

## 课程的逻辑主线

当前已发布 M01–M09 共 54 节，按“工程验证 → 正确计算 → 领域建模 → 所有权 → 借用 → 生命周期 → 抽象接口 → 数据流水线 → 错误诊断”逐步递进。详细的章节依赖、贯穿案例和后续逐课改写标准见[课程结构性重构方案](./docs/curriculum-structural-redesign.md)。

## 课程与贡献

项目规划覆盖 Rust 基础、CLI、并发与异步、Axum、数据、安全和交付。目录里的规划和草稿不代表全部课程都已发布。遇到术语、示例、命令或环境问题，请通过 GitHub Issues 报告课程编号、相关文件及复现步骤；欢迎先阅读现有内容，再通过 Pull Request 改进课程。

软件代码使用 [MIT License](./LICENSE)，原创课程与文档内容使用 [CC BY 4.0](./CONTENT-LICENSE.md)。第三方材料保留其原有许可；网站运行时依赖及 Tailwind 预置样式的许可文本见[第三方许可清单](./public/third-party-notices.txt)。请按[贡献指南](./CONTRIBUTING.md)记录来源并提交内容。
