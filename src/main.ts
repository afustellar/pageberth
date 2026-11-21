/* Inkwell — UI shell assembly.
   Architecture rule: all platform access goes through `api` (src/api.ts). */

import './styles.css'
import { applyTheme, applyHeadingColor, loadTheme, loadHeadingColor, type ThemeName, type HeadingColor } from './theme'
import { createEditor, type EditorHandle } from './editor'
import { renderMarkdown } from './markdown'
import { makeTypewriter } from './typewriter'
import { wordStat } from './wordstat'
import { wikiToMarkdown, extractWikiLinks } from './links'
import { extractHeadings, type Heading } from './outline'
import { layoutGraph } from './graph'
import { buildStandaloneHtml } from './export'
import { EditorView } from '@codemirror/view'
import { api } from './api'

type ViewMode = 'edit' | 'split' | 'preview'

interface FileMeta {
  path: string
  name: string
  label: string
  scratch?: boolean
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T

const isMac = /Mac/i.test(navigator.platform || navigator.userAgent)
const MOD = isMac ? '⌘' : 'Ctrl'
const isWinElectron = api.isElectron && !isMac

/* Unified icon set: 16px inline SVG, stroke = currentColor, 1.6px round caps. */
const I = (name: string, label: string) =>
  `<svg class="i" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg><span class="sr-only">${label}</span>`

const ICONS: Record<string, string> = {
  outline: '<path d="M4 6h16M4 12h10M4 18h13"/>',
  typewriter: '<rect x="4" y="14" width="16" height="5" rx="1.5"/><path d="M12 14V6M9 9l3-3 3 3"/>',
  palette: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5 5l1.8 1.8M17.2 17.2L19 19M19 5l-1.8 1.8M6.8 17.2L5 19"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
  graph: '<circle cx="5.5" cy="6" r="2.4"/><circle cx="18.5" cy="5" r="2.4"/><circle cx="16.5" cy="18.5" r="2.4"/><path d="M7.5 7.2l9-1.7M17.6 7.2l-1.4 9M7.2 8.1l7.6 8.5"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8l1.2 2.7 2.9-.6 1 2.8 2.7 1.2-1.6 2.5 1.6 2.5-2.7 1.2-1 2.8-2.9-.6L12 21.2l-1.2-2.7-2.9.6-1-2.8-2.7-1.2L5.8 12 4.2 9.5l2.7-1.2 1-2.8 2.9.6z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  logo: '<path d="M12 3l4.2 6.3c0 4.2-1.6 7-4.2 12.7-2.6-5.7-4.2-8.5-4.2-12.7z"/><circle cx="12" cy="11" r="1.6"/><path d="M12 12.8V19"/>'
}

const state = {
  vault: null as string | null,
  files: [] as FileMeta[],
  current: null as FileMeta | null,
  view: (localStorage.getItem('inkwell:view') as ViewMode) || 'split',
  typewriter: false,
  theme: 'light' as ThemeName,
  heading: 'ink' as HeadingColor,
  fontIdx: 0,
  lineIdx: 1,
  dirty: false,
  saveTimer: 0 as unknown as ReturnType<typeof setTimeout>
}

/* content cache for graph building (path -> raw markdown) */
const editorCache = new Map<string, string>()

/* ---------- DOM scaffold ---------- */

const root = document.getElementById('app')!

root.innerHTML = `
<div id="app-root">
  <header class="topbar">
    ${isMac ? '<div class="traffic-dots"><span class="dot-close"></span><span class="dot-min"></span><span class="dot-max"></span></div>' : ''}
    <span class="brand"><svg viewBox="0 0 512 512" width="18" height="18" aria-hidden="true"><rect width="512" height="512" rx="112" fill="#D85A30"/><path d="M150 210 h212 l-26 170 a40 40 0 0 1 -40 34 h-80 a40 40 0 0 1 -40 -34 z" fill="#FFFFFF"/><ellipse cx="256" cy="210" rx="106" ry="26" fill="#FFFFFF"/><ellipse cx="256" cy="210" rx="76" ry="17" fill="#B4451F"/><ellipse cx="256" cy="212" rx="60" ry="12" fill="#2C2C2A"/><path d="M320 92 l30 118 -44 -22 z" fill="#2C2C2A" stroke="#2C2C2A" stroke-width="10" stroke-linejoin="round"/><path d="M262 300 c14 22 22 34 22 46 a22 22 0 1 1 -44 0 c0 -12 8 -24 22 -46 z" fill="#2C2C2A"/></svg></span>
    <span class="app-title">Inkwell</span>
    <button class="vault-name" id="vault-btn" title="打开资料库文件夹">未打开资料库</button>
    <div class="seg" id="view-seg">
      <button data-view="edit">编辑</button>
      <button data-view="split">分屏</button>
      <button data-view="preview">预览</button>
    </div>
    <div class="top-actions">
      <button class="icon-btn" id="outline-btn" title="大纲面板" aria-label="大纲面板">${I('outline', '大纲面板')}</button>
      <button class="icon-btn" id="tw-btn" title="打字机专注模式 (${MOD}+J)" aria-label="打字机专注模式">${I('typewriter', '打字机专注模式')}</button>
      <button class="icon-btn" id="cmdk-btn" title="命令面板 (${MOD}+K)" aria-label="命令面板">${I('palette', '命令面板')}</button>
      <button class="icon-btn" id="theme-btn" title="切换明暗主题" aria-label="切换明暗主题">${I('moon', '切换明暗主题')}</button>
      <button class="icon-btn" id="settings-btn" title="设置" aria-label="设置">${I('gear', '设置')}</button>
    </div>
    ${isWinElectron ? `
    <div class="win-controls">
      <button class="win-btn" id="win-min" aria-label="最小化" title="最小化"><svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 12h14"/></svg></button>
      <button class="win-btn" id="win-max" aria-label="最大化" title="最大化"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5.5" y="5.5" width="13" height="13" rx="1.5"/></svg></button>
      <button class="win-btn close" id="win-close" aria-label="关闭" title="关闭"><svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>` : ''}
  </header>
  <div class="body">
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-head">
        <span class="label">笔记</span>
        <div class="actions">
          <button class="icon-btn" id="graph-btn" title="关系图谱" aria-label="关系图谱">${I('graph', '关系图谱')}</button>
          <button class="icon-btn" id="new-btn" title="新建笔记" aria-label="新建笔记">${I('plus', '新建笔记')}</button>
        </div>
      </div>
      <input class="search" id="filter-input" placeholder="搜索笔记…" />
      <div class="file-list" id="file-list"></div>
    </aside>
    <main class="workspace">
      <div class="pane pane-editor" id="pane-editor"></div>
      <div class="pane pane-preview" id="pane-preview"></div>
      <aside class="outline" id="outline-panel">
        <div class="sidebar-head"><span class="label">大纲</span></div>
        <div class="outline-list" id="outline-list"></div>
      </aside>
      <div class="welcome" id="welcome">
        <h2>Inkwell</h2>
        <p>本地优先的 Markdown 写作间</p>
        <div class="row">
          <button id="new-note-btn">新建笔记</button>
          <button id="open-vault-btn">打开文件夹</button>
          <button id="open-file-btn">打开单个文件</button>
        </div>
        <p class="hint">按 <kbd>${MOD}</kbd>+<kbd>K</kbd> 打开命令面板</p>
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
const outlinePanel = $('#outline-panel')
const outlineList = $('#outline-list')

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
  const active = !!state.current
  // welcome screen owns the workspace until a file is open
  editorPane.style.display = !active || v === 'preview' ? 'none' : ''
  previewPane.style.display = !active || v === 'edit' ? 'none' : ''
  welcomeEl.style.display = active ? 'none' : ''
  localStorage.setItem('inkwell:view', v)
  document.querySelectorAll<HTMLButtonElement>('#view-seg button').forEach(b => {
    b.classList.toggle('on', b.dataset.view === v)
  })
}

/* ---------- Markdown preview ---------- */

function renderPreview() {
  const text = editor?.view.state.doc.toString() ?? ''
  previewPane.innerHTML = renderMarkdown(wikiToMarkdown(text))
  for (const a of previewPane.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    if (a.getAttribute('href')?.startsWith('#inklink-')) {
      a.classList.add('inklink')
      a.target = '_self'
      a.addEventListener('click', e => {
        e.preventDefault()
        const target = decodeURIComponent(a.getAttribute('href')!.slice('#inklink-'.length))
        void openByName(target)
      })
    } else {
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
    }
  }
}

/* ---------- Open-or-create by wiki name ---------- */

async function openByName(target: string) {
  if (!state.vault) return
  const hit = state.files.find(f => f.label.toLowerCase() === target.toLowerCase())
  if (hit) {
    await openFile(hit)
    return
  }
  const r = await api.createFile(state.vault, target)
  if (!r.ok || !r.path) {
    alert(r.error || `无法创建「${target}」`)
    return
  }
  await refreshFiles(r.path)
}

/* ---------- Outline ---------- */

let outlineOpen = localStorage.getItem('inkwell:outline') === '1'

function applyOutline() {
  outlinePanel.style.display = outlineOpen ? '' : 'none'
  localStorage.setItem('inkwell:outline', outlineOpen ? '1' : '0')
  $('#outline-btn').classList.toggle('on', outlineOpen)
}

function renderOutline() {
  const doc = editor?.view.state.doc.toString() ?? ''
  renderOutlineList(extractHeadings(doc))
}

function renderOutlineList(headings: Heading[]) {
  outlineList.innerHTML = ''
  if (!headings.length) {
    const tip = document.createElement('div')
    tip.className = 'sidebar-empty'
    tip.textContent = '还没有标题，用 # 开几级目录吧'
    outlineList.appendChild(tip)
    return
  }
  for (const h of headings) {
    const b = document.createElement('button')
    b.className = `outline-item lv${h.level}`
    const span = document.createElement('span')
    span.textContent = h.text
    b.appendChild(span)
    b.onclick = () => jumpToLine(h.line)
    outlineList.appendChild(b)
  }
}

function jumpToLine(line: number) {
  if (!editor) return
  const v = editor.view
  const lineObj = v.state.doc.line(Math.min(line + 1, v.state.doc.lines))
  v.dispatch({
    selection: { anchor: lineObj.from },
    scrollIntoView: true,
    effects: EditorView.scrollIntoView(lineObj.from, { y: 'center' })
  })
  v.focus()
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
  for (const f of state.files) {
    if (!editorCache.has(f.path)) {
      const c = await api.readFile(f.path)
      if (c !== null) editorCache.set(f.path, c)
    }
  }
  renderFileList()
  const keep = keepPath ? state.files.find(f => f.path === keepPath) : null
  if (keep) openFile(keep)
}

function renderFileList() {
  const q = filterInput.value.trim().toLowerCase()
  fileList.innerHTML = ''
  // scratch draft sits on top of the list
  const items: FileMeta[] = state.current?.scratch ? [state.current, ...state.files] : state.files
  const shown = items.filter(f => !q || f.label.toLowerCase().includes(q))
  if (!shown.length) {
    const tip = document.createElement('div')
    tip.className = 'sidebar-empty'
    tip.textContent = state.files.length || state.current?.scratch ? '没有匹配的笔记' : '资料库还是空的，点右上角「＋」新建一篇'
    fileList.appendChild(tip)
    return
  }
  for (const f of shown) {
    const row = document.createElement('div')
    row.className = 'file-row' + (state.current?.path === f.path ? ' on' : '')
    const b = document.createElement('button')
    b.className = 'file-item'
    const span = document.createElement('span')
    span.textContent = f.label
    b.appendChild(span)
    if (f.scratch) {
      const badge = document.createElement('span')
      badge.className = 'draft-badge'
      badge.textContent = '草稿'
      b.appendChild(badge)
    }
    b.title = f.name
    b.onclick = () => { if (state.current?.path !== f.path) void openFile(f) }
    row.appendChild(b)
    const del = document.createElement('button')
    del.className = 'file-del'
    del.setAttribute('aria-label', `删除 ${f.label}`)
    del.title = '删除'
    del.textContent = '✕'
    del.onclick = async e => {
      e.stopPropagation()
      if (f.scratch) {
        if (state.current?.path === f.path) await deleteCurrent()
        else { state.files = state.files; /* unreachable: scratch is always current */ }
        return
      }
      if (!confirm(`删除「${f.name}」？此操作不可撤销。`)) return
      const wasCurrent = state.current?.path === f.path
      const ok = await api.deleteFile(f.path)
      if (!ok) { alert('删除失败'); return }
      editorCache.delete(f.path)
      if (wasCurrent) {
        state.current = null
        editor?.view.dispatch({ changes: { from: 0, to: editor.view.state.doc.length, insert: '' } })
        applyView()
        updateStatus()
        renderPreview()
      }
      await refreshFiles()
    }
    row.appendChild(del)
    fileList.appendChild(row)
  }
}

async function openFile(f: FileMeta) {
  const ed = ensureEditor()
  const content = (await api.readFile(f.path)) ?? ''
  editorCache.set(f.path, content)
  ed.view.dispatch({
    changes: { from: 0, to: ed.view.state.doc.length, insert: content }
  })
  state.current = f
  renderFileList()
  applyView()
  setSaveState('clean')
  updateStatus()
  renderPreview()
  renderOutline()
  ed.view.focus()
}

function onDocChanged() {
  if (!state.current) return
  updateStatus()
  renderPreview()
  renderOutline()
  setSaveState('dirty')
  if (state.current.scratch) return // scratch drafts save only on demand
  clearTimeout(state.saveTimer)
  state.saveTimer = setTimeout(saveCurrent, 600)
}

async function saveCurrent() {
  if (!state.current || !editor) return
  if (state.current.scratch) {
    await materializeScratch()
    return
  }
  const content = editor.view.state.doc.toString()
  const ok = await api.writeFile(state.current.path, content)
  if (ok) {
    editorCache.set(state.current.path, content)
    setSaveState('clean')
  }
}

async function newNote() {
  // scratch flow: start writing immediately; pick a home at first save
  const draft: FileMeta = { path: 'scratch:未命名', name: '未命名.md', label: '未命名', scratch: true }
  if (state.current && state.dirty) await saveCurrent()
  state.current = draft
  ensureEditor().view.dispatch({
    changes: { from: 0, to: editor!.view.state.doc.length, insert: `# 未命名\n\n` }
  })
  if (state.view === 'preview') {
    state.view = 'split'
  }
  applyView()
  renderFileList()
  setSaveState('dirty')
  updateStatus()
  renderPreview()
  renderOutline()
  editor!.view.focus()
}

/** Materialize the scratch draft into a real file. Returns the file or null if user canceled. */
async function materializeScratch(): Promise<FileMeta | null> {
  const draft = state.current
  if (!draft || !draft.scratch) return draft ?? null
  if (!state.vault) {
    const ok = await pickVault()
    if (!ok) return null
  }
  const title = (editor?.view.state.doc.line(1).text.replace(/^#\s*/, '').trim()) || draft.label
  const base = title || '未命名'
  let name = base
  let i = 1
  const have = new Set(state.files.map(f => f.name))
  while (have.has(`${name}.md`)) name = `${base} ${i++}`
  const r = await api.createFile(state.vault!, name)
  if (!r.ok || !r.path) {
    alert(r.error || '创建失败')
    return null
  }
  const content = editor!.view.state.doc.toString()
  const okWrite = await api.writeFile(r.path, content)
  if (!okWrite) {
    alert('保存失败')
    return null
  }
  const real: FileMeta = { path: r.path, name: r.name || `${name}.md`, label: labelOf(r.name || `${name}.md`) }
  editorCache.set(real.path, content)
  state.current = real
  await refreshFiles(real.path)
  return real
}

async function deleteCurrent() {
  if (!state.current) return
  if (state.current.scratch) {
    // discard draft, back to welcome
    state.current = null
    editor?.view.dispatch({ changes: { from: 0, to: editor.view.state.doc.length, insert: '' } })
    applyView()
    renderFileList()
    updateStatus()
    renderPreview()
    return
  }
  if (!confirm(`删除「${state.current.name}」？此操作不可撤销。`)) return
  const ok = await api.deleteFile(state.current.path)
  if (!ok) {
    alert('删除失败')
    return
  }
  editorCache.delete(state.current.path)
  state.current = null
  editor?.view.dispatch({ changes: { from: 0, to: editor.view.state.doc.length, insert: '' } })
  applyView()
  updateStatus()
  renderPreview()
  await refreshFiles()
}

async function renameCurrent() {
  if (!state.current || !editor) return
  if (state.current.scratch) {
    // renaming the draft = retitling it before first save
    const newName = await askText(`给这篇笔记起个名字：`, state.current.label)
    if (!newName || newName.trim() === state.current.label) return
    const safe = newName.trim()
    editor.view.dispatch({
      changes: { from: 0, to: editor.view.state.doc.length, insert: editor.view.state.doc.toString().replace(/^(#\s*).*$/m, `$1${safe}`) }
    })
    state.current = { ...state.current, label: safe, name: `${safe}.md` }
    renderFileList()
    return
  }
  const newName = await askText('重命名为（不含扩展名）：', state.current.label)
  if (!newName || newName.trim() === state.current.label) return
  const content = editor.view.state.doc.toString()
  await api.writeFile(state.current.path, content) // flush pending changes first
  const r = await api.renameFile(state.current.path, newName.trim())
  if (!r.ok || !r.path) {
    alert(r.error || '重命名失败')
    return
  }
  const old = state.current
  editorCache.delete(old.path)
  state.current = { path: r.path, name: old.name.replace(/[^/\\]+/, r.path.split(/[\\/]/).pop() || old.name), label: newName.trim() }
  await refreshFiles(r.path)
  setSaveState('clean')
}

async function exportHtml() {
  if (!state.current || !editor) return
  const content = editor.view.state.doc.toString()
  const html = buildStandaloneHtml(state.current.label, content)
  const where = await api.exportFile(`${state.current.label}.html`, html)
  if (where) setSaveState('clean')
}

async function exportPdf() {
  if (!state.current || !editor) return
  const content = editor.view.state.doc.toString()
  const html = buildStandaloneHtml(state.current.label, content)
  await api.exportPdf(html)
}

async function pickVault(): Promise<boolean> {
  const v = await api.pickFolder()
  if (!v) return false
  state.vault = v
  try { localStorage.setItem('inkwell:lastVault', v) } catch { /* ignore */ }
  vaultBtn.textContent = api.isElectron ? v.split(/[\\/]/).pop() || v : v
  vaultBtn.title = v
  applyView()
  await refreshFiles()
  return true
}

/* ---------- Open a single loose file ---------- */

async function openLooseFile() {
  if (!api.openFileDialog) return
  const r = await api.openFileDialog()
  if (!r) return
  if (state.current && state.dirty) await saveCurrent()
  ensureEditor().view.dispatch({
    changes: { from: 0, to: editor!.view.state.doc.length, insert: r.content }
  })
  const label = r.path.split(/[\\/]/).pop()?.replace(/\.(md|markdown|txt)$/i, '') || '文件'
  state.current = { path: r.path, name: r.path.split(/[\\/]/).pop() || label, label, scratch: true }
  applyView()
  renderFileList()
  setSaveState('dirty')
  updateStatus()
  renderPreview()
  renderOutline()
  editor!.view.focus()
}

/* ---------- Resume last vault ---------- */

async function resumeLastVault(): Promise<boolean> {
  let last: string | null = null
  try { last = localStorage.getItem('inkwell:lastVault') } catch { /* ignore */ }
  if (!last) return false
  const r = await api.readDir(last)
  if (!r) return false
  state.vault = last
  vaultBtn.textContent = api.isElectron ? last.split(/[\\/]/).pop() || last : last
  vaultBtn.title = last
  applyView()
  await refreshFiles()
  return true
}

/* ---------- Graph view ---------- */

function renderGraphView() {
  const svg = $('#graph-svg')
  const input = state.files.filter(f => !f.scratch).map(f => ({
    label: f.label,
    outgoing: extractWikiLinks(editorCache.get(f.path) ?? '').map(l => l.target)
  }))
  const g = layoutGraph({ nodes: input })
  svg.setAttribute('viewBox', `0 0 ${g.width} ${g.height}`)
  const R = 7 + Math.min(9, g.nodes.reduce((s, n) => s + n.degree, 0) * 0.6 / Math.max(1, g.nodes.length))
  let html = ''
  for (const e of g.edges) {
    const a = g.nodes.find(n => n.id === e.from)!
    const b = g.nodes.find(n => n.id === e.to)!
    html += `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" class="g-edge"/>`
  }
  for (const n of g.nodes) {
    const r = n.orphan ? 6 : 7 + n.degree * 1.6
    html += `<g class="g-node${n.id === state.current?.label ? ' cur' : ''}" data-id="${n.id}" transform="translate(${n.x.toFixed(1)},${n.y.toFixed(1)})">`
    html += `<circle r="${r.toFixed(1)}" ${n.orphan ? 'class="orphan"' : ''}/>`
    html += `<text y="${(r + 11).toFixed(1)}" text-anchor="middle"></text></g>`
  }
  svg.innerHTML = html
  for (const t of svg.querySelectorAll<SVGTextElement>('.g-node text')) {
    t.textContent = t.parentElement!.dataset.id || ''
  }
  svg.querySelectorAll<SVGGElement>('.g-node').forEach(el => {
    el.addEventListener('click', () => {
      const f = state.files.find(x => x.label === el.dataset.id)
      if (f) { closeGraphModal(); void openFile(f) }
    })
  })
}

function openGraphModal() {
  if ($('#graph-modal')) return
  const wrap = document.createElement('div')
  wrap.id = 'graph-modal'
  wrap.className = 'modal-overlay'
  wrap.innerHTML = `
    <div class="modal graph-modal">
      <div class="modal-head">
        <span class="label">关系图谱</span>
        <button class="icon-btn" id="graph-close" title="关闭">✕</button>
      </div>
      <svg id="graph-svg"></svg>
    </div>`
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) closeGraphModal() })
  $('#palette-root').appendChild(wrap)
  $('#graph-close').addEventListener('click', closeGraphModal)
  renderGraphView()
}

function closeGraphModal() {
  $('#graph-modal')?.remove()
}

/* ---------- Theme ---------- */

function applyThemeUI() {
  const btn = $('#theme-btn')
  btn.innerHTML = I(state.theme === 'dark' ? 'sun' : 'moon', '切换明暗主题')
  document.documentElement.style.colorScheme = state.theme
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark'
  applyTheme(state.theme, state.heading)
  applyThemeUI()
}

/* ---------- Settings ---------- */

function setHeadingColor(c: HeadingColor) {
  state.heading = c
  try { localStorage.setItem('inkwell:headingColor', c) } catch { /* ignore */ }
  applyHeadingColor(c, state.theme)
  renderPreview()
}

/* ---------- Typography settings (font size / line height) ---------- */

const FONT_STEPS = [13, 15, 17]   // px
const LINE_STEPS = [1.7, 2.0, 2.4] // multiplier

function loadTypography(): { fontIdx: number; lineIdx: number } {
  let f = 0, l = 1
  try {
    const fsRaw = localStorage.getItem('inkwell:fontIdx')
    const lhRaw = localStorage.getItem('inkwell:lineIdx')
    if (fsRaw !== null && FONT_STEPS[Number(fsRaw)] !== undefined) f = Number(fsRaw)
    if (lhRaw !== null && LINE_STEPS[Number(lhRaw)] !== undefined) l = Number(lhRaw)
  } catch { /* ignore */ }
  return { fontIdx: f, lineIdx: l }
}

function applyTypography() {
  const size = FONT_STEPS[state.fontIdx]
  const lh = LINE_STEPS[state.lineIdx]
  const root = document.documentElement
  root.style.setProperty('--ink-editor-size', size + 'px')
  root.style.setProperty('--ink-editor-lh', String(lh))
  // preview scales slightly larger than the editor
  root.style.setProperty('--ink-preview-size', size + 2 + 'px')
  root.style.setProperty('--ink-preview-lh', String(Math.max(1.6, lh - 0.1)))
}

function setFontIdx(i: number) {
  state.fontIdx = Math.max(0, Math.min(FONT_STEPS.length - 1, i))
  try { localStorage.setItem('inkwell:fontIdx', String(state.fontIdx)) } catch { /* ignore */ }
  applyTypography()
}

function setLineIdx(i: number) {
  state.lineIdx = Math.max(0, Math.min(LINE_STEPS.length - 1, i))
  try { localStorage.setItem('inkwell:lineIdx', String(state.lineIdx)) } catch { /* ignore */ }
  applyTypography()
}

function openSettings() {
  if ($('#settings-modal')) return
  const wrap = document.createElement('div')
  wrap.id = 'settings-modal'
  wrap.className = 'modal-overlay'
  const opt = (id: string, label: string, swatch: string, cur: boolean) =>
    `<button class="set-opt${cur ? ' on' : ''}" data-hc="${id}"><span class="sw" style="background:${swatch}"></span>${label}${cur ? '<span class="set-check">✓</span>' : ''}</button>`
  const seg = (group: string, idx: number, labels: string[]) =>
    `<div class="set-seg" data-group="${group}">${labels.map((t, i) => `<button data-i="${i}" class="${i === idx ? 'on' : ''}">${t}</button>`).join('')}</div>`
  const hc = state.heading
  wrap.innerHTML = `
    <div class="modal settings-modal">
      <div class="modal-head">
        <span class="label">设置</span>
        <button class="icon-btn" id="settings-close" title="关闭" aria-label="关闭">✕</button>
      </div>
      <div class="set-group">
        <div class="set-label">标题颜色</div>
        <div class="set-list">
          ${opt('ink', '墨黑（默认）', '#242320', hc === 'ink')}
          ${opt('violet', '紫罗兰（原设计稿）', '#534AB7', hc === 'violet')}
          ${opt('coral', '珊瑚', '#B4451F', hc === 'coral')}
        </div>
      </div>
      <div class="set-group">
        <div class="set-label">字号</div>
        ${seg('font', state.fontIdx, ['小', '中', '大'])}
      </div>
      <div class="set-group">
        <div class="set-label">行距</div>
        ${seg('line', state.lineIdx, ['紧凑', '适中', '宽松'])}
      </div>
    </div>`
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) closeSettings() })
  $('#palette-root').appendChild(wrap)
  $('#settings-close').addEventListener('click', closeSettings)
  wrap.querySelectorAll<HTMLButtonElement>('.set-opt').forEach(b => {
    b.addEventListener('click', () => {
      setHeadingColor(b.dataset.hc as HeadingColor)
      closeSettings()
    })
  })
  wrap.querySelectorAll<HTMLButtonElement>('.set-seg button').forEach(b => {
    b.addEventListener('click', () => {
      const group = (b.closest('.set-seg') as HTMLElement).dataset.group
      const i = Number(b.dataset.i)
      if (group === 'font') setFontIdx(i)
      else setLineIdx(i)
      // refresh active state
      wrap.querySelectorAll<HTMLButtonElement>(`.set-seg[data-group="${group}"] button`).forEach(x => {
        x.classList.toggle('on', Number(x.dataset.i) === i)
      })
    })
  })
}

function closeSettings() {
  $('#settings-modal')?.remove()
}

/* ---------- Typewriter ---------- */

function setTypewriter(on: boolean) {
  state.typewriter = on
  $('#tw-btn').classList.toggle('on', on)
}

/* ---------- In-app text prompt (prompt() is unavailable in Electron) ---------- */

function askText(title: string, initial: string): Promise<string | null> {
  return new Promise(resolve => {
    const wrap = document.createElement('div')
    wrap.id = 'ask-overlay'
    wrap.className = 'modal-overlay'
    wrap.innerHTML = `
      <div class="modal ask-modal">
        <div class="modal-head"><span class="label"></span></div>
        <input id="ask-input" />
        <div class="ask-actions">
          <button id="ask-cancel">取消</button>
          <button id="ask-ok" class="primary">确定</button>
        </div>
      </div>`
    ;(wrap.querySelector('.label') as HTMLElement).textContent = title
    $('#palette-root').appendChild(wrap)
    const input = $<HTMLInputElement>('#ask-input')
    input.value = initial
    input.focus()
    input.select()
    const done = (v: string | null) => {
      wrap.remove()
      resolve(v)
      editor?.view.focus()
    }
    $('#ask-ok').addEventListener('click', () => done(input.value.trim() || null))
    $('#ask-cancel').addEventListener('click', () => done(null))
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); done(input.value.trim() || null) }
      else if (e.key === 'Escape') done(null)
    })
    wrap.addEventListener('mousedown', e => { if (e.target === wrap) done(null) })
  })
}

;(window as any).__inkAsk = askText

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
    { id: 've', icon: '✎', label: '视图：仅编辑', hint: `${MOD}+1`, run: () => setView('edit') },
    { id: 'vs', icon: '◫', label: '视图：分屏', hint: `${MOD}+2`, run: () => setView('split') },
    { id: 'vp', icon: '▷', label: '视图：仅预览', hint: `${MOD}+3`, run: () => setView('preview') },
    { id: 'theme', icon: state.theme === 'dark' ? '☀' : '☾', label: '切换明暗主题', run: toggleTheme },
    { id: 'tw', icon: '⌶', label: '打字机专注模式', hint: `${MOD}+J`, run: () => setTypewriter(!state.typewriter) },
    { id: 'save', icon: '⟳', label: '保存当前笔记', hint: `${MOD}+S`, run: saveCurrent },
    { id: 'outline', icon: '☰', label: '大纲面板：开/关', run: () => { outlineOpen = !outlineOpen; applyOutline() } },
    { id: 'graph', icon: '⬡', label: '查看关系图谱', run: openGraphModal },
    { id: 'settings', icon: '⚙', label: '打开设置', run: openSettings },
    { id: 'folder', icon: '📁', label: '打开资料库文件夹…', run: pickVault }
  ]
  if (state.current) {
    list.push({ id: 'rename', icon: '✎', label: `重命名「${state.current.label}」`, run: renameCurrent })
    list.push({ id: 'del', icon: '✕', label: `删除「${state.current.name}」`, run: deleteCurrent })
    list.push({ id: 'exp-html', icon: '⇥', label: `导出「${state.current.label}」为 HTML`, run: exportHtml })
    list.push({ id: 'exp-pdf', icon: '⇥', label: `导出「${state.current.label}」为 PDF`, run: exportPdf })
  }
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
$('#settings-btn').addEventListener('click', openSettings)
$('#outline-btn').addEventListener('click', () => { outlineOpen = !outlineOpen; applyOutline() })
$('#graph-btn').addEventListener('click', openGraphModal)
$('#tw-btn').addEventListener('click', () => setTypewriter(!state.typewriter))
$('#cmdk-btn').addEventListener('click', openPalette)
$('#new-btn').addEventListener('click', newNote)
vaultBtn.addEventListener('click', pickVault)
$('#open-vault-btn').addEventListener('click', pickVault)
$('#open-file-btn').addEventListener('click', () => void openLooseFile())
$('#new-note-btn').addEventListener('click', newNote)
filterInput.addEventListener('input', renderFileList)

/* ---------- Custom window controls (Windows frameless) ---------- */

if (isWinElectron && api.winControl) {
  $('#win-min').addEventListener('click', () => api.winControl!('minimize'))
  $('#win-max').addEventListener('click', () => api.winControl!('maximize'))
  $('#win-close').addEventListener('click', () => api.winControl!('close'))
  document.querySelector('.topbar')?.addEventListener('dblclick', e => {
    if ((e.target as HTMLElement).closest('button, .seg')) return
    api.winControl!('maximize')
  })
}

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
  if (state.dirty && state.current && !state.current.scratch) void saveCurrent()
})

/* ---------- Boot ---------- */

state.theme = loadTheme()
state.heading = loadHeadingColor()
const typo = loadTypography()
state.fontIdx = typo.fontIdx
state.lineIdx = typo.lineIdx
applyTheme(state.theme, state.heading)
applyTypography()
applyThemeUI()
applyView()
applyOutline()
setTypewriter(false)
ensureEditor()
updateStatus()
renderPreview()
renderOutline()
void resumeLastVault()


