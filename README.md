
# 灵语智造 (LinguaCNC)

**🔥 一个由大学生发起、社区驱动的开源 AI 数控编程平台**

> **📢 我们的开源宣言 (Manifesto)**
>
> 本项目源自几个热爱制造与 AI 的大学生的一个“疯狂想法”。我们没有庞大的资金，也没有顶级的商业团队，但我们有对技术的热爱和**开源共创**的信念。
>
> 传统的工业 CAM 软件往往昂贵且门槛极高。我们希望打破这种壁垒，探索 AI 在制造业的无限可能。**LinguaCNC (灵语智造)** 不仅仅是一个工具，它更是一个**属于大家的社区**。
>
> 无论你是懂 React 的前端极客、研究 LLM 的算法同学、精通 G 代码的机加老手，还是刚刚接触机械的学弟学妹，甚至只是有一个好点子，我们都张开双臂欢迎你！
>
> **聚沙成塔，众木成林。全凭我们自己，用代码敲出属于我们的“智造”未来！欢迎提交 PR、提出 Issue，让我们一起完善它！**

LinguaCNC (灵语智造) 是一个集成了人工智能大模型（LLM）的智能 CAM（计算机辅助制造）助手。它允许用户通过自然语言对话、上传技术图纸（PDF/DXF）或 3D 模型，自动生成标准的 CNC G 代码，并提供实时的 3D 切削仿真。

![App Screenshot](public/screenshot.png) *(如果有截图可以放在这里)*

## 🎯 开发目的

本项目旨在降低数控编程（CNC Programming）的技术门槛。通过结合最新的生成式 AI 技术与传统的 CAM 算法，实现从“自然语言/图纸”到“加工代码”的端到端自动化。主要解决传统编程学习曲线陡峭、人工编程效率低、容易出错等痛点，为机械加工从业者和学生提供一个高效、直观的辅助工具。

## 🏭 面向领域 / 行业

*   **机械制造行业**: 用于零部件的快速打样和中小批量生产。
*   **数控加工 (CNC)**: 辅助操机师傅快速生成简单程序的 G 代码。
*   **职业教育**: 作为数控编程教学的辅助工具，帮助学生理解代码与加工动作的对应关系。
*   **创客与 DIY**: 降低桌面级 CNC 设备的使用难度。

## 🚀 软件的主要功能

1.  **自然语言编程**: 支持用户通过语音或文字描述加工需求（如“铣一个直径50的圆槽”），自动解析几何参数并生成代码。
2.  **多模态图纸识别**: 支持上传 PDF 工程图、DXF 矢量图或位图，AI 自动提取特征尺寸。
3.  **智能 G 代码生成**: 基于 ISO 标准生成铣削、钻孔、面铣等通用 G 代码，支持 FANUC/Siemens 等主流系统格式。
4.  **实时 3D 仿真**: 内置 WebGL 仿真引擎，通过 CSG（构造实体几何）技术实时模拟材料去除过程，可视化验证刀路安全性。
5.  **智能刀具库管理**: 允许用户维护自定义刀具库，AI 生成代码时自动匹配最优刀具。
6.  **工艺单自动生成**: 一键生成包含工件尺寸、刀具列表、预估工时的加工工艺单，支持打印导出。
7.  **代码编辑与优化**: 内置 G 代码编辑器，支持语法高亮；提供 AI 代码优化功能，自动调整进给转速。
8.  **多端跨平台支持**: 采用响应式设计，同时支持 PC 浏览器、桌面端 (Electron) 和移动端 (iOS/Android)。

## 💻 开发的硬件环境

*   **处理器 (CPU)**: Intel Core i5 / AMD Ryzen 5 或更高（推荐用于 3D 渲染加速）。
*   **内存 (RAM)**: 8GB 或更高 (推荐 16GB 以流畅运行本地开发环境)。
*   **硬盘**: SSD 固态硬盘，剩余空间不少于 10GB。
*   **显示器**: 分辨率 1920x1080 或更高。
*   **操作系统**: Windows 10/11, macOS 12+, 或 Linux (Ubuntu 20.04+)。

## 🖥️ 软件运行支撑环境 / 支持软件

### 1. 开发环境 (Development)
*   **操作系统**: Windows 10/11, macOS, Linux.
*   **编程语言/运行环境**: Node.js (v18.0.0+), TypeScript (v5.0+).
*   **包管理器**: npm (v9.0+) 或 yarn.
*   **开发工具**: Visual Studio Code (推荐安装 ESLint, Prettier 插件).
*   **移动端构建工具**: Android Studio (Android SDK API 30+), Xcode (iOS 15+ SDK).

### 2. 运行环境 (Runtime)
*   **Web 端**:
    *   现代浏览器: Google Chrome (90+), Microsoft Edge (90+), Safari (15+), Firefox.
    *   **关键依赖**: 必须支持 **WebGL 2.0** (用于 3D 仿真渲染).
*   **桌面客户端 (Electron)**:
    *   Windows 7/10/11 (64-bit).
    *   macOS 10.15 (Catalina) 及以上.
*   **移动客户端**:
    *   Android 7.0 及以上.
    *   iOS 13.0 及以上.

### 3. 核心依赖库 (Key Libraries)
*   **前端框架**: React v18, Tailwind CSS.
*   **3D 图形引擎**: Three.js, three-bvh-csg (布尔运算).
*   **跨平台框架**: Capacitor (移动端), Electron (桌面端).
*   **构建工具**: Vite.

## 📊 源程序量

*   **代码行数**: 约 5,000+ 行 (不含第三方库依赖)。
*   **主要技术栈**: TypeScript, React, Tailwind CSS, Three.js (3D 引擎), Capacitor (移动端), Electron (桌面端)。

---

## 🛠️ 环境配置与安装

### 前置要求

*   **Node.js**: 推荐版本 v18.0.0 或更高。
*   **npm** 或 **yarn**: 用于包管理。

### 1. 获取代码

```bash
git clone https://github.com/your-username/linguacnc.git
cd linguacnc
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量与模型服务 (API Key)

本项目的大脑依赖于云端的大语言模型（LLM）。为了让程序能够正常思考和生成 G 代码，你需要配置相应的 API Key。

> ⚠️ **安全警告**：
> 永远不要把你的 API Key 提交到公开的代码仓库（如 GitHub）中！
> 本项目已经配置了 `.gitignore` 来忽略 `.env` 文件，请确保你只在本地的 `.env` 文件中填写 Key。

#### 第一步：创建 `.env` 配置文件

在项目的根目录下，你会看到一个名为 `.env.example` 的文件。这是一个模板文件。
你需要复制它并重命名为 `.env`：

```bash
# 在终端中运行此命令，或者手动复制粘贴并重命名
cp .env.example .env
```

#### 第二步：获取 API Key

本项目支持多种大模型，你可以根据自己的网络情况和偏好选择**其中一种或多种**进行配置：

**1. Google Gemini (首选推荐，效果最佳)**
*   **获取方式**：
    1. 访问 [Google AI Studio](https://aistudio.google.com/)。
    2. 登录你的 Google 账号。
    3. 点击左侧导航栏的 **"Get API key"**。
    4. 点击 **"Create API key"** 按钮生成一串字符，这就是你的 Key。
*   **填写位置**：
    打开你刚刚创建的 `.env` 文件，找到 `GEMINI_API_KEY` 和 `VITE_GEMINI_API_KEY`，将你的 Key 粘贴进去：
    ```env
    GEMINI_API_KEY=AIzaSyYourGeminiKeyHere...
    VITE_GEMINI_API_KEY=AIzaSyYourGeminiKeyHere...
    ```
*   *(可选) 代理配置*：如果你在国内无法直接访问 Google 服务，你需要配置代理 URL：
    ```env
    GEMINI_BASE_URL=https://你的代理地址/v1beta
    VITE_GEMINI_BASE_URL=https://你的代理地址/v1beta
    ```

**2. 阿里云 通义千问 (Qwen) (国内推荐，无需代理)**
*   **获取方式**：
    1. 访问 [阿里云百炼大模型平台](https://bailian.console.aliyun.com/)。
    2. 注册/登录阿里云账号，并开通百炼服务。
    3. 在控制台右上角点击头像，选择 **"API-KEY"**。
    4. 点击 **"创建新的 API-KEY"**。
*   **填写位置**：
    在 `.env` 文件中找到 `VITE_ALIYUN_API_KEY`：
    ```env
    VITE_ALIYUN_API_KEY=sk-YourAliyunKeyHere...
    ```

**3. 小米 MiMo (如果你有内测权限)**
*   **获取方式**：通过小米内部或开放平台渠道获取。
*   **填写位置**：
    ```env
    VITE_MIMO_API_KEY=YourMiMoKeyHere...
    ```

#### 第三步：理解环境变量的作用

在 `.env` 文件中，你会看到两种前缀的变量：
*   **没有前缀的变量** (如 `GEMINI_API_KEY`)：这些是**后端专用的环境变量**。它们只会在 Node.js 服务器 (如 `server.ts`) 中运行，绝对不会被打包到前端网页中，**安全性极高**。
*   **以 `VITE_` 开头的变量** (如 `VITE_GEMINI_API_KEY`)：这些是**前端环境变量**。Vite 构建工具会将它们打包到最终的网页代码中，以便在浏览器中直接调用 API。
    *   *注意：在生产环境中（部署到公网），尽量避免在前端暴露 API Key。本项目为了方便本地开发和纯前端演示，保留了前端直连的能力。*

## 🚀 运行与构建

### Web 开发模式 (浏览器)

在本地启动开发服务器，支持热重载：

```bash
npm run dev
```
访问 `http://localhost:5173` 即可使用。

### 桌面端 (Electron)

在开发模式下启动 Electron 窗口：

```bash
npm run electron:dev
```

构建 Windows/Mac 安装包：

```bash
npm run electron:build
```
构建产物位于 `release/` 目录。

### 移动端 (Android/iOS)

本项目使用 Capacitor 构建移动应用。

1.  **同步 Web 资源**:
    ```bash
    npm run cap:sync
    ```

2.  **Android**:
    *   确保已安装 Android Studio。
    *   运行 `npm run cap:android` 打开 Android 项目进行构建或模拟器运行。

3.  **iOS** (仅限 macOS):
    *   确保已安装 Xcode。
    *   运行 `npm run cap:ios` 打开 Xcode 项目。

## 🤝 贡献与联系我们

欢迎提交 Issue 或 Pull Request 来改进这个项目！

**联系我们 / 加入我们：**
如果你对这个项目感兴趣，想要一起共创，或者有任何建议，欢迎随时通过邮件联系我们：
📧 **[jackoikpig@gmail.com](mailto:jackoikpig@gmail.com)**

## 🌸 特别鸣谢

特别感谢 **方小姐**。
纵有遗憾，仍感念你在我最迷茫之际，伸手相拔。

## 📄 许可证

MIT License
