# Inkwell 交接文档（HANDOFF）

> 给新机器上的 Alma / 开发者：读完这份文档即可无缝继续开发，无需重新对齐需求。
> 创建时间：2026-11-20（周五）。产品尚未对外发布，无历史包袱。

## 1. 一句话定位

**Inkwell — 本地优先的 Markdown 写作软件。** 不搞数据库、不搞云、不搞账号。直接打开磁盘上的一个文件夹作为"资料库"（vault），`.md` 文件就是全部数据，用户随时可以带着文件离开。

目标用户：用 Markdown 写长文/笔记的人。卖点排序：**手感 > 专注 > 关联**，功能宁少勿滥。

## 2. 已确认的设计决策（用户已看过设计稿并拍板"可以"）

- **产品名**：Inkwell
- **三态视图**：编辑 / 分屏 / 预览，顶栏 segmented control 一键切换，默认分屏
- **双主题**：右上角月亮/太阳按钮切换明暗，跟随系统为初始值，选择持久化到 localStorage
- **命令面板 ⌘K**：所有操作的统一入口，不堆工具栏按钮（新建、切换打字机模式、插入代码块、导出 PDF 等）
- **打字机专注模式 ⌘J**：光标行始终居中，通过滚动实现（见 src/typewriter.ts，已写好）
- **双向链接图谱**：`[[笔记名]]` 自动建链，侧栏图谱可视化（设计稿里有，代码还没写）
- **状态栏**：字数（中日韩字 + 英文词混合统计，见 src/wordstat.ts）、阅读时长、自动保存状态、编码格式
- **视觉基调**：暖纸白 + 珊瑚橘 accent（#D85A30），拒绝冷冰冰的科技蓝。全部色值已在 src/theme.ts 里定义为 CSS 变量（`--ink-*` 前缀），明暗两套。

### 设计稿色板（已落码，改色直接改 theme.ts）

| token | light | dark |
|---|---|---|
| bg | #FFFFFF | #17161B |
| panel | #F7F6F2 | #1E1D23 |
| border | #E4E2DB | #32313A |
| fg | #2C2C2A | #E9E7E3 |
| muted | #8A887F | #9A98A2 |
| accent | #D85A30 | #F0997B |
| mdH（标题） | #534AB7 | #AFA9EC |
| mdStrong | #0F6E56 | #5DCAA5 |
| mdCodeBg/Fg | #FAEEDA / #633806 | #2B2718 / #FAC775 |
| mdLink | #185FA5 | #85B7EB |

编辑器语法高亮：标题紫、加粗绿、行内代码琥珀底、链接蓝下划线，标点符号弱化成灰色（`--ink-mdPunct`）——这是"手感"的核心，别改成无色高亮。

## 3. 技术选型（已定，勿换）

- **Electron + Vite + TypeScript（无框架，原生 DOM）**。刻意不引 React/Vue：应用小，原生够了，少一层构建心智。
- **CodeMirror 6** 做编辑器（@codemirror/view、state、commands、lang-markdown、search），marked + DOMPurify 做预览渲染。
- 双入口：`index.html`（Vite dev，端口 5178）与 `electron/index.html`（打包用，指 ./src/main.ts）。主进程在 `electron/main.ts`，preload 用 contextBridge 暴露 `window.inkwell` API。

## 4. 文件清单与状态

| 文件 | 状态 | 说明 |
|---|---|---|
| package.json | ✅ | 依赖已声明；缺 `electron:dev`/`electron:build` script，见 §6 |
| vite.config.ts | ✅ | base:'./'（electron file:// 兼容）、port 5178 |
| index.html / electron/index.html | ✅ | 双入口 |
| electron/main.ts | ✅ | IPC：pickFolder/readDir/readFile/writeFile/createFile/deleteFile/renameFile，文件限 5MB、过滤 .md/.markdown/.txt |
| electron/preload.cjs | ✅ | contextBridge，方法名与 src/api.ts 接口一一对应 |
| src/api.ts | ✅ | `InkwellApi` 接口 + Electron 实现 + Web 降级实现（localStorage 模拟 vault）|
| src/theme.ts | ✅ | 明暗双主题 CSS 变量注入 |
| src/editor.ts | ✅ | CodeMirror 6 装配：行号、活动行、搜索、历史、markdown 语法 + 自定义 HighlightStyle |
| src/typewriter.ts | ✅ | 打字机模式（updateListener + rAF 滚动居中），**还没接进 editor/main** |
| src/wordstat.ts | ✅ | CJK+拉丁混合字数统计 |
| src/markdown.ts | ⚠️ | 基本能用，但 DOMPurify config 里有一段写废的 `ALLOWED_TAGS: undefined` 占位，清理掉；顺手把链接加 `target="_blank"` |
| src/main.ts | ❌ **缺失** | 整个 UI 壳：布局、顶栏、侧栏、三态切换、状态栏、命令面板、全部在这里组装。**这是下一步的第一件事** |
| src/styles.css | ❌ 缺失 | 全局样式（顶栏/侧栏/分栏/状态栏），参照设计稿 mockup |
| 命令面板 / 图谱 / 导出 / 大纲 | ❌ 未开始 | 见 §6 路线图 |

## 5. 架构约定（重要，别破坏）

1. **所有平台能力走 `InkwellApi` 接口**（src/api.ts）。UI 层只调 `api.xxx`，不直接碰 window.inkwell / localStorage。Web 降级实现是给纯浏览器预览用的，语义是"localStorage 模拟"，key 前缀 `inkwell:vault:<名字>/files/<文件名>.md`。
2. 主题切换 = `applyTheme()` 灌 CSS 变量，编辑器内部颜色全部引用 `var(--ink-*)`，不要硬编码色值进 CodeMirror theme。
3. Electron 安全底线：contextIsolation: true、nodeIntegration: false、preload 白名单 IPC。主进程对路径/文件名做消毒（已做）。
4. `src/editor.ts` 里 `themeComp`/`darkComp` 两个 Compartment 目前是占位（空扩展）。如果最终用不上就删掉，用上了就是给运行时换主题/暗色语法用的。

## 6. 路线图（按这个顺序做）

1. **src/main.ts + styles.css**：组装完整 UI 壳。布局 = 顶栏(traffic dots + 文件名 + 三态segmented + 主题按钮) / 左侧栏(搜索框 + 文件列表) / 编辑|预览分栏 / 状态栏。接上 typewriter 和 wordstat。
2. **命令面板 ⌘K**：模糊搜索命令 + 笔记，键盘上下选择，Enter 执行。命令注册表先做：新建笔记、切视图×3、切主题、打字机开关、删除文件、导出。
3. **大纲面板**：解析 `#`~`######` 生成右侧可点击目录，点击滚动编辑器对应行。
4. **双向链接**：预览渲染时把 `[[名字]]` 转内部链接（点击即打开/创建该笔记）；图谱视图用 SVG 力导向或环形布局，节点=笔记，边=链接。
5. **导出**：先 HTML（内联样式，self-contained），再 PDF（Electron printToPDF）。
6. **打磨**：自动保存（600ms debounce）+ 状态栏"已保存"指示、文件树折叠文件夹、最近打开、空的欢迎页文案。

## 7. 怎么跑

```bash
npm install
npm run dev          # 纯 Web 预览，http://localhost:5178（localStorage 模式）
npm run build        # 产出 dist/
# Electron：
#   先加 script：electron:dev 用 vite dev server + electron .，electron:build 用 electron-builder（未配置）
#   最小验证：npm run build 后 electron . 加载 electron/index.html（需先把 dist 并进去或直接 vite build --base ./）
```

**注意**：package.json 还没有 electron 相关 script 和 electron-builder 配置，这是待办（§6 第 1 步时顺手补）。

## 8. 对话背景（人的部分）

- 用户中文交流，风格是"按你的想法做，先给设计再动手"。设计稿已在聊天里确认过，不需要重新征求意见，直接按本文档 §2 执行。
- 2026-11-20 用户暂停了开发要换电脑继续。交接物 = 本文件 + README.md + 已提交的 git 仓库 + inkwell-handoff-20261120.zip（不含 node_modules）。
- 新会话第一步：`Read` 本文件 → `git log --oneline` 看进度 → 从 §6 第 1 项（src/main.ts）继续。
