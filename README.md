# Inkwell

本地优先的 Markdown 写作软件。打开一个文件夹就是你的资料库，`.md` 文件永远是你的文件。

![status](https://img.shields.io/badge/status-alpha-orange)

## 当前状态

路线图六步全部完成：UI 壳 / 命令面板 ⌘K / 大纲面板 / 双向链接 + 图谱 / 导出 HTML·PDF / 自动保存与恢复。

- 三态视图（编辑 / 分屏 / 预览），明暗双主题跟随系统
- `[[笔记名]]`、`[[笔记名|别名]]` 双链，点击自动开笔记；⬡ 弹出力导向关系图谱
- 大纲面板点击跳行；打字机专注模式
- 导出：自包含单文件 HTML（内联当前主题色）+ PDF（Electron printToPDF）
- Windows / macOS / Linux（Electron）；Windows 下自动隐藏 mac 红绿灯、快捷键显示 Ctrl

**接手前必读 [HANDOFF.md](./HANDOFF.md)** —— 完整的产品决策、色板、架构约定、路线图和进度记录。

## 开发

```bash
npm install
npm run dev      # Web 预览 @ :5178
npm run build    # 产物在 dist/
```

Electron 运行方式见 HANDOFF.md §7。

## 技术栈

Electron · Vite · TypeScript · CodeMirror 6 · marked + DOMPurify
