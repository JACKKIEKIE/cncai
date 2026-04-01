# LinguaCNC 论坛 Demo 发布说明

## 目标

这份 Demo 的定位不是替代主项目，而是：

- 用最短时间让别人看懂项目在做什么
- 保留产品方向、样例流程和可视化效果
- 隐藏完整工艺引擎、真实 AI 工作流和私有知识产权
- 用于论坛首发、同好招募、合作交流

## 这版 Demo 包含什么

- 固定样例的自然语言意图展示
- 固定样例的工序拆解
- 代表性 G 代码片段
- 3D 仿真预览
- 面向论坛的项目介绍和招募文案

## 这版 Demo 不包含什么

- 自由输入后的真实 AI 工艺生成
- 完整后处理模板
- 真实刀补与机床适配规则
- 私有刀具库、历史工程、内部工作流

## Web Demo 构建

```bash
npm install
npm run build:demo
```

构建产物输出到：

```text
dist/
```

## Android Demo APK 构建

```bash
npm install
npm run apk:demo
```

预期 APK 输出位置：

```text
android/app/build/outputs/apk/demo/release/app-demo-release.apk
```

如果你想重新同步但暂时不打包，可以先运行：

```bash
npm run cap:sync:demo
```

## 推荐部署方式：Cloudflare Pages 静态站

为什么推荐它：

- 只发布 `dist` 静态文件
- 不会把服务端路由一起暴露出去
- 很适合论坛 Demo 这种“只展示方向”的公开页面

### 方法 A：直接上传 `dist`

1. 先本地执行 `npm run build:demo`
2. 登录 Cloudflare Pages
3. 创建一个新的 Pages 项目
4. 选择“直接上传”或“Upload assets”
5. 上传整个 `dist` 文件夹
6. 发布后就会得到一个 `*.pages.dev` 的演示网址

### 方法 B：连接 GitHub 仓库

1. 在 Cloudflare Pages 新建项目
2. 连接 GitHub 仓库 `JACKKIEKIE/cncai`
3. 构建命令填：

```bash
npm run build:demo
```

4. 输出目录填：

```text
dist
```

5. 环境变量可以留空
6. 完成后发布，得到演示网址

## 论坛首发建议

建议你在帖子里强调这几点：

- 这是公开 Demo，不是完整商业版
- 重点演示“自然语言 -> 工艺样例 -> 程序预览 -> 3D 仿真”
- 当前希望招募懂制造、懂 AI、懂产品表达的人一起共建

## 可直接使用的论坛文案

```text
项目名：LinguaCNC Demo

我们在做一个面向中文制造场景的 AI CNC 助手。

这次公开的是论坛试用版，不包含完整工艺内核，只展示一条固定样例流程：
自然语言意图 -> 工序拆解 -> 样例 G 代码 -> 3D 仿真预览。

我想找的是愿意一起把这件事做深的人：
- 机械 / CNC 工艺
- AI / Agent
- 前端可视化 / Three.js
- 产品表达与社区共建

如果你对“AI + 制造”这条路感兴趣，欢迎交流。
```

## 联系入口

- 邮箱：`jackoikpig@gmail.com`
- 仓库：`https://github.com/JACKKIEKIE/cncai`
