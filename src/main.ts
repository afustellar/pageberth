/* Inkwell — UI shell assembly.
   Architecture rule: all platform access goes through `api` (src/api.ts). */

import './styles.css'
import { applyTheme, loadTheme, type ThemeName } from './theme'
import { createEditor, type EditorHandle } from './editor'
import { renderMarkdown } from './markdown'
import { makeTypewriter } from './typewriter'
import { wordStat } from './wordstat'
import { api } from './api'

type ViewMode = 'edit' | 'split' | 'preview'

interface FileMeta {
  path: string
  name: string
  label: string
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T

const state = {
  vault: null as string | null,
  files: [] as FileMeta[],
  current: null as FileMeta | null,
  view: (localStorage.getItem('inkwell:view') as ViewMode) || 'split',
  typewriter: false,
  theme: 'light' as ThemeName,
  dirty: false,
  saveTimer: 0 as unknown as ReturnType<typeof setTimeout>
}

/* ---------- DOM scaffold ---------- */

const root = document.getElementById('app')!

root.innerHTML = `
<div id="app-root">
  <header class="topbar">
    <div class="traffic-dots"><span class="dot-close"></span><span class="dot-min"></span><span class="dot-max"></span></div>
    <span class="app-title">Inkwell</span>
    <button class="vault-name" id="vault-btn" title="打开资料库文件夹">未打开资料库</button>
    <div class="seg" id="view-seg">
      <button data-view="edit">编辑</button>
      <button data-view="split">分屏</button>
      <button data-view="preview">预览</button>
    </div>
    <div class="top-actions">
      <button class="icon-btn" id="tw-btn" title="打字机专注模式 (⌘J)">⌶</button>
      <button class="icon-btn" id="cmdk-btn" title="命令面板 (⌘K)">⌘</button>
      <button class="icon-btn" id="theme-btn" title="切换明暗主题">☾</button>
    </div>
  </header>
  <div class="body">
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-head">
        <span class="label">笔记</span>
        <button class="icon-btn" id="new-btn" title="新建笔记">＋</button>
      </div>
      <input class="search" id="filter-input" placeholder="搜索笔记…" />
      <div class="file-list" id="file-list"></div>
    </aside>
    <main class="workspace">
      <div class="pane pane-editor" id="pane-editor"></div>
      <div class="pane pane-preview" id="pane-preview"></div>
      <div class="welcome" id="welcome">
        <h2>Inkwell</h2>
        <p>本地优先的 Markdown 写作间</p>
        <div class="row">
          <button id="open-vault-btn">打开文件夹</button>
          <button id="new-note-btn">新建笔记</button>
        </div>
        <p class="hint">按 <kbd>Ctrl</kbd>+<kbd>K</kbd> 打开命令面板</p>
      </div>
    </main>
  </div>
  <footer class="statusbar">
    <span id="st-words">0 字</span>
    <span id="st-read">约 1 分钟</span>
    <span class="spacer"></span>
    <span class="save-state" id="st-save">就绪</span>
  </footer>
</div>
<div id="palette-root"></div>
`

const editorPane = $('#pane-editor')
const previewPane = $('#pane-preview')
const welcomeEl = $('#welcome')
const fileList = $('#file-list')
const filterInput = $<HTMLInputElement>('#filter-input')
const vaultBtn = $('#vault-btn')
const stWords = $('#st-words')
const stRead = $('#st-read')
const stSave = $('#st-save')

/* ---------- Editor ---------- */

let editor: EditorHandle | null = null

function ensureEditor() {
  if (editor) return editor
  editor = createEditor(editorPane, '', () => onDocChanged(), [makeTypewriter(() => state.typewriter)])
  editor.view.dom.style.height = '100%'
  return editor
}

/* ---------- View mode ---------- */

function applyView() {
  const v = state.view
  editorPane.style.display = v === 'preview' ? 'none' : ''
  previewPane.style.display = v === 'edit' ? 'none' : ''
  localStorage.setItem('inkwell:view', v)
  document.querySelectorAll<HTMLButtonElement>('#view-seg button').forEach(b => {
    b.classList.toggle('on', b.dataset.view === v)
  })
}

/* ---------- Markdown preview ---------- */

function renderPreview() {
  const text = editor?.view.state.doc.toString() ?? ''
  previewPane.innerHTML = renderMarkdown(text)
  for (const a of previewPane.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
  }
}

/* ---------- Status bar ---------- */

function updateStatus() {
  const text = editor?.view.state.doc.toString() ?? ''
  const s = wordStat(text)
  stWords.textContent = `${s.words} 字`
  stRead.textContent = `约 ${s.readMinutes} 分钟`
}

function setSaveState(kind: 'clean' | 'dirty' | 'saved') {
  state.dirty = kind === 'dirty'
  stSave.textContent = kind === 'clean' ? '已保存' : kind === 'dirty' ? '编辑中…' : '已保存'
  stSave.classList.toggle('dirty', kind === 'dirty')
}

/* ---------- File operations ---------- */

function labelOf(name: string) {
  return name.replace(/\.(md|markdown|txt)$/i, '')
}

async function refreshFiles(keepPath?: string) {
  if (!state.vault) return
  const r = await api.readDir(state.vault)
  if (!r) return
  const web = !api.isElectron
  state.files = r.files.map((name, i) => ({
    path: web ? `vault:${state.vault}/files/${name}` : `${state.vault}\\${name}`,
    name,
    label: labelOf(name)
  }))
  renderFileList()
  const keep = keepPath ? state.files.find(f => f.path === keepPath) : null
  if (keep) openFile(keep)
}

function renderFileList() {
  const q = filterInput.value.trim().toLowerCase()
  fileList.innerHTML = ''
  const shown = state.files.filter(f => !q || f.label.toLowerCase().includes(q))
  if (!shown.length) {
    const tip = document.createElement('div')
    tip.className = 'sidebar-empty'
    tip.textContent = state.files.length ? '没有匹配的笔记' : '资料库还是空的，点右上角「＋」新建一篇'
    fileList.appendChild(tip)
    return
  }
  for (const f of shown) {
    const b = document.createElement('button')
    b.className = 'file-item' + (state.current?.path === f.path ? ' on' : '')
    const span = document.createElement('span')
    span.textContent = f.label
    b.appendChild(span)
    b.title = f.name
    b.onclick = () => openFile(f)
    fileList.appendChild(b)
  }
}

async function openFile(f: FileMeta) {
  const ed = ensureEditor()
  const content = (await api.readFile(f.path)) ?? ''
  ed.view.dispatch({
    changes: { from: 0, to: ed.view.state.doc.length, insert: content }
  })
  state.current = f
  renderFileList()
  welcomeEl.style.display = 'none'
  setSaveState('clean')
  updateStatus()
  renderPreview()
  ed.view.focus()
}

function onDocChanged() {
  if (!state.current) return
  updateStatus()
  renderPreview()
  setSaveState('dirty')
  clearTimeout(state.saveTimer)
  state.saveTimer = setTimeout(saveCurrent, 600)
}

async function saveCurrent() {
  if (!state.current || !editor) return
  const ok = await api.writeFile(state.current.path, editor.view.state.doc.toString())
  if (ok) setSaveState('clean')
}

async function newNote() {
  if (!state.vault) {
    const ok = await pickVault()
    if (!ok) return
  }
  const base = '未命名'
  let name = base
  let i = 1
  const have = new Set(state.files.map(f => f.name))
  while (have.has(`${name}.md`)) name = `${base} ${i++}`
  const r = await api.createFile(state.vault!, name)
  if (!r.ok || !r.path) {
    alert(r.error || '创建失败')
    return
  }
  await refreshFiles(r.path)
  if (state.view === 'preview') {
    state.view = 'split'
    applyView()
  }
  const ed = ensureEditor()
  ed.view.focus()
}

async function deleteCurrent() {
  if (!state.current) return
  if (!confirm(`删除「${state.current.name}」？此操作不可撤销。`)) return
  const ok = await api.deleteFile(state.current.path)
  if (!ok) {
    alert('删除失败')
    return
  }
  state.current = null
  editor?.view.dispatch({ changes: { from: 0, to: editor.view.state.doc.length, insert: '' } })
  welcomeEl.style.display = ''
  updateStatus()
  renderPreview()
  await refreshFiles()
}

async function pickVault(): Promise<boolean> {
  const v = await api.pickFolder()
  if (!v) return false
  state.vault = v
  vaultBtn.textContent = api.isElectron ? v.split(/[\\/]/).pop() || v : v
  vaultBtn.title = v
  welcomeEl.style.display = 'none'
  await refreshFiles()
  return true
}

/* ---------- Theme ---------- */

function applyThemeUI() {
  const btn = $('#theme-btn')
  btn.textContent = state.theme === 'dark' ? '☀' : '☾'
  document.documentElement.style.colorScheme = state.theme
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark'
  applyTheme(state.theme)
  applyThemeUI()
}

/* ---------- Typewriter ---------- */

function setTypewriter(on: boolean) {
  state.typewriter = on
  $('#tw-btn').classList.toggle('on', on)
}

/* ---------- Command palette ---------- */

interface Command {
  id: string
  icon: string
  label: string
  hint?: string
  run: () => void | Promise<void>
}

function commands(): Command[] {
  const list: Command[] = [
    { id: 'new', icon: '＋', label: '新建笔记', run: newNote },
    { id: 've', icon: '✎', label: '视图：仅编辑', hint: '⌃1', run: () => setView('edit') },
    { id: 'vs', icon: '◫', label: '视图：分屏', hint: '⌃2', run: () => setView('split') },
    { id: 'vp', icon: '▷', label: '视图：仅预览', hint: '⌃3', run: () => setView('preview') },
    { id: 'theme', icon: state.theme === 'dark' ? '☀' : '☾', label: '切换明暗主题', run: toggleTheme },
    { id: 'tw', icon: '⌶', label: '打字机专注模式', hint: '⌃J', run: () => setTypewriter(!state.typewriter) },
    { id: 'save', icon: '⟳', label: '保存当前笔记', hint: '⌃S', run: saveCurrent },
    { id: 'folder', icon: '📁', label: '打开资料库文件夹…', run: pickVault }
  ]
  if (state.current) list.push({ id: 'del', icon: '✕', label: `删除「${state.current.name}」`, run: deleteCurrent })
  for (const f of state.files) {
    list.push({ id: 'note:' + f.path, icon: '•', label: '打开：' + f.label, run: () => openFile(f) })
  }
  return list
}

function score(s: string, q: string): number {
  s = s.toLowerCase()
  q = q.toLowerCase()
  if (s.startsWith(q)) return 0
  const idx = s.indexOf(q)
  if (idx >= 0) return 1 + idx / 100
  // subsequence match
  let i = 0
  for (const ch of s) if (ch === q[i]) i++
  return i === q.length ? 10 : Infinity
}

let paletteSel = 0
let paletteItems: Command[] = []

function openPalette() {
  if ($('#palette-overlay')) return
  const wrap = document.createElement('div')
  wrap.id = 'palette-overlay'
  wrap.className = 'palette-overlay'
  wrap.innerHTML = `
    <div class="palette">
      <input id="palette-input" placeholder="输入命令或搜索笔记…" />
      <div class="palette-list" id="palette-list"></div>
    </div>`
  wrap.addEventListener('mousedown', e => {
    if (e.target === wrap) closePalette()
  })
  $('#palette-root').appendChild(wrap)

  const input = $<HTMLInputElement>('#palette-input')
  const listBox = $('#palette-list')

  function updateList() {
    const q = input.value.trim()
    const all = commands()
    paletteItems = q
      ? all.map(c => ({ c, s: score(c.label, q) })).filter(x => x.s !== Infinity).sort((a, b) => a.s - b.s).map(x => x.c)
      : all
    paletteSel = 0
    listBox.innerHTML = ''
    if (!paletteItems.length) {
      listBox.innerHTML = '<div class="palette-empty">没有匹配的命令</div>'
      return
    }
    paletteItems.forEach((c, i) => {
      const b = document.createElement('button')
      b.className = 'palette-item' + (i === paletteSel ? ' sel' : '')
      b.innerHTML = `<span class="pi-icon"></span><span class="pi-label"></span><span class="pi-hint"></span>`
      ;(b.querySelector('.pi-icon') as HTMLElement).textContent = c.icon
      ;(b.querySelector('.pi-label') as HTMLElement).textContent = c.label
      ;(b.querySelector('.pi-hint') as HTMLElement).textContent = c.hint || ''
      b.onclick = () => { closePalette(); void c.run() }
      b.onmousemove = () => {
        if (paletteSel !== i) { paletteSel = i; paintSel() }
      }
      listBox.appendChild(b)
    })
  }

  function paintSel() {
    listBox.querySelectorAll('.palette-item').forEach((el, i) => {
      el.classList.toggle('sel', i === paletteSel)
    })
  }

  function moveSel(d: number) {
    if (!paletteItems.length) return
    paletteSel = (paletteSel + d + paletteItems.length) % paletteItems.length
    paintSel()
    listBox.querySelectorAll('.palette-item')[paletteSel]?.scrollIntoView({ block: 'nearest' })
  }

  input.oninput = updateList
  input.onkeydown = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveSel(-1) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      const c = paletteItems[paletteSel]
      if (c) { closePalette(); void c.run() }
    } else if (e.key === 'Escape') closePalette()
  }
  input.focus()
  updateList()
}

function closePalette() {
  $('#palette-overlay')?.remove()
  editor?.view.focus()
}

/* ---------- Global wiring ---------- */

function setView(v: ViewMode) {
  state.view = v
  applyView()
}

$('#view-seg').addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('button[data-view]')
  if (b) setView((b as HTMLElement).dataset.view as ViewMode)
})

$('#theme-btn').addEventListener('click', toggleTheme)
$('#tw-btn').addEventListener('click', () => setTypewriter(!state.typewriter))
$('#cmdk-btn').addEventListener('click', openPalette)
$('#new-btn').addEventListener('click', newNote)
vaultBtn.addEventListener('click', pickVault)
$('#open-vault-btn').addEventListener('click', pickVault)
$('#new-note-btn').addEventListener('click', newNote)
filterInput.addEventListener('input', renderFileList)

window.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey
  if (mod && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault()
    openPalette()
  } else if (mod && (e.key === 'j' || e.key === 'J')) {
    e.preventDefault()
    setTypewriter(!state.typewriter)
  } else if (mod && (e.key === 's' || e.key === 'S')) {
    e.preventDefault()
    void saveCurrent()
  } else if (mod && e.key === '1') {
    e.preventDefault(); setView('edit')
  } else if (mod && e.key === '2') {
    e.preventDefault(); setView('split')
  } else if (mod && e.key === '3') {
    e.preventDefault(); setView('preview')
  }
})

window.addEventListener('beforeunload', () => {
  if (state.dirty) void saveCurrent()
})

/* ---------- Boot ---------- */

state.theme = loadTheme()
applyThemeUI()
applyView()
setTypewriter(false)
ensureEditor()
updateStatus()
renderPreview()


