# Inkwell

本地优先的 Markdown 写作软件。打开一个文件夹就是你的资料库，`.md` 文件永远是你的文件。

![status](https://img.shields.io/badge/status-WIP%20v0.1-orange)

## 当前状态

设计与核心模块已就绪，UI 壳（src/main.ts）尚未编写。**接手前必读 [HANDOFF.md](./HANDOFF.md)** —— 那里有完整的产品决策、色板、架构约定和路线图。

## 开发

```bash
npm install
npm run dev      # Web 预览 @ :5178
npm run build    # 产物在 dist/
```

Electron 运行方式见 HANDOFF.md §7。

## 技术栈

Electron · Vite · TypeScript · CodeMirror 6 · marked + DOMPurify
