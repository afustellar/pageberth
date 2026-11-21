<div align="center">

<img src="assets/screenshot.png" alt="Inkwell" width="900">

**你的笔记，只属于这台电脑**

[![status](https://img.shields.io/badge/version-0.1.0--alpha-orange)](https://github.com/skpcd/inkwell/releases)
[![platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-blue)](#下载安装)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)

[下载安装包](#下载安装) · [功能一览](#功能一览) · [开发](#开发)

</div>

---

Inkwell 是**本地优先**的 Markdown 写作软件：打开一个文件夹就是你的资料库，`.md` 文件永远是你的文件。不搞数据库、不搞云、不搞账号 —— 你的笔记，只属于这台电脑。

## 功能一览

| | |
|---|---|
| ✍️ **三态视图** | 编辑 / 分屏 / 预览，一键切换，默认分屏 |
| 🔗 **双向链接** | `[[笔记名]]` 自动建链，点击跳转或创建，支持别名 |
| 🕸 **关系图谱** | 零依赖力导向图，节点按连接数加权，孤岛笔记一目了然 |
| 📋 **大纲面板** | 六级标题目录，点击跳行，预览模式同步滚动 |
| 🔎 **全文搜索** | 跨笔记搜内容，带上下文片段（`Ctrl+Shift+F`） |
| ⚡ **快速切换** | 最近打开优先的笔记切换器（`Ctrl+P`） |
| 🖼 **图片粘贴** | 剪贴板截图直接贴进笔记，存入 `assets/` |
| 🗑 **回收站** | 删除先进回收站，可恢复，防手滑 |
| 📤 **导出** | 自包含单文件 HTML + PDF（Electron printToPDF） |
| 🌗 **主题系统** | 明暗模式（可跟随系统）× 5 种主题色 |
| ⌨️ **命令面板** | `Ctrl+K`，所有操作的统一入口 |

## 下载安装

从 [Releases](https://github.com/skpcd/inkwell/releases) 下载对应平台的安装包：

| 平台 | 文件 | 说明 |
|------|------|------|
| Windows | `Inkwell-Setup-0.1.0-alpha.exe` | 引导式安装，可选目录；未签名，SmartScreen 提示请选"仍要运行" |
| Linux | `Inkwell-0.1.0-alpha.AppImage` / `.deb` | AppImage 免安装直接运行 |
| macOS | 计划中 | 需 macOS 环境打包（欢迎 PR） |

## 开发

```bash
npm install        # 安装依赖（electron 会从镜像下载，国内可用 ELECTRON_MIRROR）
npm run dev        # Web 预览 @ http://localhost:5178（localStorage 模拟资料库）
npm run typecheck  # TypeScript 类型检查
npm run electron:dev    # 打包并启动桌面应用
npm run electron:build  # 产出安装包到 release/
```

技术栈：Electron · Vite · TypeScript（无框架，原生 DOM）· CodeMirror 6 · marked + DOMPurify

接手开发前请读 [HANDOFF.md](./HANDOFF.md) —— 完整的产品决策、架构约定与路线图。

## 设计原则

**手感 > 专注 > 关联**，功能宁少勿滥。暖纸白界面 + 可换主题色，拒绝冷冰冰的科技蓝；编辑器语法高亮遵循 GitHub 惯例，克制中性。

## License

MIT
