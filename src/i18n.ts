/* Minimal i18n: dictionary + persisted language. zh default. */

export type Lang = 'zh' | 'en' | 'ja'

const STR = {
  zh: {
    edit: '编辑', split: '分屏', preview: '预览',
    outline: '大纲面板', typewriter: '打字机专注模式', palette: '命令面板',
    theme: '切换明暗主题', settings: '设置', graph: '关系图谱',
    newNote: '新建笔记', notes: '笔记', search: '搜索笔记…',
    emptyVault: '资料库还是空的，点右上角「＋」新建一篇',
    noMatch: '没有匹配的笔记',
    backlinks: '反向链接', outlineList: '大纲',
    draft: '草稿', trashTitle: '移入回收站', restore: '恢复',
    trashEmpty: '回收站是空的', trash: '回收站', emptyTrash: '清空回收站',
    openVault: '打开文件夹', openFile: '打开文件', welcomeSlogan: '落笔即安',
    hintPalette: '打开命令面板', words: '字', minutes: '约 {n} 分钟',
    saved: '已保存', editing: '编辑中…', ready: '就绪',
    daily: '今日 +{n} 字', vault: '未打开资料库', openVaultTitle: '打开资料库文件夹',
    settingsTitle: '设置', accent: '主题色',
    fontSize: '字号', lineHeight: '行距', small: '小', medium: '中', large: '大',
    tight: '紧凑', comfy: '适中', loose: '宽松', update: '更新',
    checkUpdate: '检查更新', curVersion: '当前版本 {v}', latest: '已是最新版本',
    downloading: '下载中…', dlDone: '下载完成，重启即装', restartInstall: '立即重启安装',
    checkFail: '网络错误，稍后再试', devMode: '开发模式无更新',
    close: '关闭', minimize: '最小化', maximize: '最大化', cancel: '取消', ok: '确定',
    renameTo: '重命名为（不含扩展名）：', retitle: '给这篇笔记起个名字：',
    deleteNote: '把「{n}」移入回收站？', viewEdit: '视图：仅编辑',
    viewSplit: '视图：分屏', viewPreview: '视图：仅预览', switchTheme: '切换明暗主题',
    saveNote: '保存当前笔记', toggleOutline: '大纲面板：开/关', viewGraph: '查看关系图谱',
    openVaultCmd: '打开资料库文件夹…', openSettingsCmd: '打开设置', searchCmd: '全文搜索',
    quickSwitch: '快速切换笔记', deleteCmd: '删除「{n}」', renameCmd: '重命名「{n}」',
    exportHtml: '导出「{n}」为 HTML', exportPdf: '导出「{n}」为 PDF',
    searchInput: '在所有笔记的内容中搜索…', searchNone: '没有匹配的命令',
    minChars: '输入至少两个字符', noHits: '没有包含「{q}」的笔记',
    recent: '最近', switchTitle: '切换笔记', switchPh: '笔记名…（最近打开的排前面）',
    langLabel: '语言 / Language / 言語'
  },
  en: {
    edit: 'Edit', split: 'Split', preview: 'Preview',
    outline: 'Outline', typewriter: 'Typewriter focus', palette: 'Command palette',
    theme: 'Toggle theme', settings: 'Settings', graph: 'Graph view',
    newNote: 'New note', notes: 'Notes', search: 'Search notes…',
    emptyVault: 'Vault is empty — click ＋ to create one',
    noMatch: 'No matching notes',
    backlinks: 'Backlinks', outlineList: 'Outline',
    draft: 'Draft', trashTitle: 'Move to trash', restore: 'Restore',
    trashEmpty: 'Trash is empty', trash: 'Trash', emptyTrash: 'Empty trash',
    openVault: 'Open folder', openFile: 'Open file', welcomeSlogan: 'Quiet writing. Notes stay on this machine.',
    hintPalette: 'open command palette', words: 'words', minutes: '~{n} min',
    saved: 'Saved', editing: 'Editing…', ready: 'Ready',
    daily: 'Today +{n} words', vault: 'No vault open', openVaultTitle: 'Open vault folder',
    settingsTitle: 'Settings', accent: 'Accent',
    fontSize: 'Font size', lineHeight: 'Line height', small: 'S', medium: 'M', large: 'L',
    tight: 'Tight', comfy: 'Normal', loose: 'Loose', update: 'Updates',
    checkUpdate: 'Check for updates', curVersion: 'Version {v}', latest: 'Up to date',
    downloading: 'Downloading…', dlDone: 'Downloaded — restart to install', restartInstall: 'Restart & install',
    checkFail: 'Network error, try later', devMode: 'Dev mode: no updates',
    close: 'Close', minimize: 'Minimize', maximize: 'Maximize', cancel: 'Cancel', ok: 'OK',
    renameTo: 'Rename (no extension):', retitle: 'Name this note:',
    deleteNote: 'Move "{n}" to trash?', viewEdit: 'View: Edit only',
    viewSplit: 'View: Split', viewPreview: 'View: Preview only', switchTheme: 'Toggle theme',
    saveNote: 'Save note', toggleOutline: 'Toggle outline panel', viewGraph: 'Open graph view',
    openVaultCmd: 'Open vault folder…', openSettingsCmd: 'Open settings', searchCmd: 'Search notes',
    quickSwitch: 'Quick switcher', deleteCmd: 'Delete "{n}"', renameCmd: 'Rename "{n}"',
    exportHtml: 'Export "{n}" as HTML', exportPdf: 'Export "{n}" as PDF',
    searchInput: 'Search across all notes…', searchNone: 'No matching commands',
    minChars: 'Type at least 2 characters', noHits: 'No notes containing "{q}"',
    recent: 'recent', switchTitle: 'Switch note', switchPh: 'Note name… (recent first)',
    langLabel: 'Language / 语言 / 言語'
  },
  ja: {
    edit: '編集', split: '分割', preview: 'プレビュー',
    outline: 'アウトライン', typewriter: 'タイプライターモード', palette: 'コマンドパレット',
    theme: 'テーマ切替', settings: '設定', graph: 'グラフビュー',
    newNote: '新規ノート', notes: 'ノート', search: 'ノートを検索…',
    emptyVault: '空のボルトです。右上の「＋」で作成してください',
    noMatch: '一致するノートがありません',
    backlinks: 'バックリンク', outlineList: 'アウトライン',
    draft: '下書き', trashTitle: 'ゴミ箱へ移動', restore: '復元',
    trashEmpty: 'ゴミ箱は空です', trash: 'ゴミ箱', emptyTrash: 'ゴミ箱を空にする',
    openVault: 'フォルダを開く', openFile: 'ファイルを開く', welcomeSlogan: '静かに書く。ノートはこの PC の中に。',
    hintPalette: 'コマンドパレットを開く', words: '文字', minutes: '約 {n} 分',
    saved: '保存済み', editing: '編集中…', ready: '準備完了',
    daily: '今日 +{n} 文字', vault: 'ボルト未選択', openVaultTitle: 'ボルトフォルダを開く',
    settingsTitle: '設定', accent: 'テーマカラー',
    fontSize: '文字サイズ', lineHeight: '行間', small: '小', medium: '中', large: '大',
    tight: '狭い', comfy: '標準', loose: '広い', update: 'アップデート',
    checkUpdate: '更新を確認', curVersion: '現在のバージョン {v}', latest: '最新です',
    downloading: 'ダウンロード中…', dlDone: '完了 — 再起動で適用', restartInstall: '再起動してインストール',
    checkFail: 'ネットワークエラー', devMode: '開発モードのため更新なし',
    close: '閉じる', minimize: '最小化', maximize: '最大化', cancel: 'キャンセル', ok: 'OK',
    renameTo: '新しい名前（拡張子なし）：', retitle: 'ノートに名前を付ける：',
    deleteNote: '「{n}」をゴミ箱へ移動しますか？', viewEdit: '表示：編集のみ',
    viewSplit: '表示：分割', viewPreview: '表示：プレビューのみ', switchTheme: 'テーマ切替',
    saveNote: '保存', toggleOutline: 'アウトライン切替', viewGraph: 'グラフを開く',
    openVaultCmd: 'ボルトフォルダを開く…', openSettingsCmd: '設定を開く', searchCmd: '全文検索',
    quickSwitch: 'クイックスイッチ', deleteCmd: '「{n}」を削除', renameCmd: '「{n}」を名前変更',
    exportHtml: '「{n}」を HTML で書き出す', exportPdf: '「{n}」を PDF で書き出す',
    searchInput: 'すべてのノートを検索…', searchNone: '一致するコマンドなし',
    minChars: '2 文字以上入力してください', noHits: '「{q}」を含むノートはありません',
    recent: '最近', switchTitle: 'ノート切替', switchPh: 'ノート名…（最近順）',
    langLabel: '言語 / Language / 语言'
  }
}

let cur: Lang = 'zh'
try {
  const stored = localStorage.getItem('inkwell:lang') as Lang | null
  if (stored && STR[stored]) cur = stored
} catch { /* ignore */ }

export function t(key: keyof typeof STR.zh, vars?: Record<string, string | number>): string {
  let out: string = (STR[cur] as Record<string, string>)[key] ?? STR.zh[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replace(`{${k}}`, String(v))
  return out
}

export function getLang(): Lang { return cur }

export function setLang(l: Lang) {
  if (!STR[l]) return
  cur = l
  try { localStorage.setItem('inkwell:lang', l) } catch { /* ignore */ }
}

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'zh', label: '中文' },
  { id: 'en', label: 'English' },
  { id: 'ja', label: '日本語' }
]
