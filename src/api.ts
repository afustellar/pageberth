export interface InkwellApi {
  isElectron: boolean
  pickFolder(): Promise<string | null>
  getLastVault?(): Promise<string | null>
  openFileDialog?(): Promise<{ path: string; content: string } | null>
  writeBinary?(dir: string, name: string, data: Uint8Array): Promise<{ ok: boolean; path?: string; error?: string }>
  readDir(dir: string): Promise<{ files: string[]; folders: string[] } | null>
  readFile(p: string): Promise<string | null>
  writeFile(p: string, content: string, expected?: string): Promise<{ ok: boolean; conflict?: boolean }>
  createFile(dir: string, name: string): Promise<{ ok: boolean; path?: string; name?: string; error?: string }>
  saveConflictCopy(vault: string | null, source: string, name: string, content: string): Promise<{ ok: boolean; path?: string; name?: string; canceled?: boolean; error?: string }>
  deleteFile(p: string): Promise<boolean>
  renameFile(p: string, newName: string): Promise<{ ok: boolean; path?: string; error?: string }>
  exportFile(defaultName: string, html: string): Promise<string | null>
  exportPdf(html: string): Promise<string | null>
  listTrash?(vault: string): Promise<string[]>
  restoreTrash?(vault: string, name: string): Promise<{ ok: boolean; path?: string; error?: string }>
  emptyTrash?(vault: string): Promise<boolean>
  getLastUpdate?(): Promise<string | null>
  checkUpdate?(): Promise<{ version?: string | null; current?: string; downloaded?: boolean; dev?: boolean; error?: string }>
  downloadUpdate?(): Promise<boolean>
  installUpdate?(): void
  onUpdate?(cb: (version: string) => void): void
  onUpdateProgress?(cb: (p: { percent: number; bps: number }) => void): void
  onUpdateReady?(cb: () => void): void
  onOpenFile?(cb: (path: string) => void): void
  watchVault?(dir: string): Promise<boolean>
  onVaultChange?(cb: (vault: string, name: string | null, failed: boolean) => void): void
  winControl?(action: 'minimize' | 'maximize' | 'close'): void
  isMaximized?(): Promise<boolean>
}

function lsGet(key: string): string | null {
  try { return localStorage.getItem('inkwell:' + key) } catch { return null }
}
function lsSet(key: string, v: string): boolean {
  try { localStorage.setItem('inkwell:' + key, v); return true } catch { return false }
}

function lsRemove(key: string): boolean {
  try { localStorage.removeItem('inkwell:' + key); return true } catch { return false }
}

const webApi: InkwellApi = {
  isElectron: false,

  async pickFolder() {
    // prompt() is unavailable under Electron; the app injects window.__inkAsk when it loads
    const ask = (window as any).__inkAsk as ((title: string, initial: string) => Promise<string | null>) | undefined
    const name = ask ? await ask('给这个资料库起个名字：', '我的笔记') : prompt('给这个资料库起个名字：', '我的笔记')
    if (!name) return null
    const key = 'vault:' + name
    if (!lsGet(key) && !lsSet(key, JSON.stringify({ files: {} }))) return null
    lsSet('lastVault', name)
    return name
  },

  async writeBinary(dir: string, name: string, data: Uint8Array) {
    // web fallback: base64 data URL in localStorage (small images only)
    try {
      let bin = ''
      for (const b of data) bin += String.fromCharCode(b)
      const b64 = btoa(bin)
      const ext = name.split('.').pop()?.toLowerCase()
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/png'
      const key = 'vault:' + dir + '/assets/' + name
      if (!lsSet(key, JSON.stringify({ dataUrl: `data:${mime};base64,${b64}` }))) {
        return { ok: false, error: '图片存储失败' }
      }
      return { ok: true, path: key }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  },

  async openFileDialog() {
    // browser fallback: plain <input type=file>
    return new Promise(resolve => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.md,.markdown,.txt'
      input.onchange = async () => {
        const f = input.files?.[0]
        if (!f) return resolve(null)
        resolve({ path: `file:${f.name}`, content: await f.text() })
      }
      input.click()
    })
  },

  async readDir(vault: string) {
    // enumerate real per-file keys instead of the (never-populated) manifest
    const prefix = 'inkwell:vault:' + vault + '/files/'
    const files: string[] = []
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith(prefix)) files.push(k.slice(prefix.length))
      }
    } catch { return null }
    files.sort((a, b) => a.localeCompare(b, 'zh'))
    return { files, folders: [] }
  },

  async readFile(p: string) {
    const raw = lsGet(p)
    return raw ? JSON.parse(raw).content : null
  },

  async writeFile(p: string, content: string, expected?: string) {
    const raw = lsGet(p)
    if (!raw) return { ok: false }
    const entry = JSON.parse(raw)
    if (expected !== undefined && entry.content !== expected) return { ok: false, conflict: true }
    entry.content = content
    return { ok: lsSet(p, JSON.stringify(entry)) }
  },

  async createFile(vault: string, name: string) {
    const safe = name.replace(/[\\/:*?"<>|]/g, '-').trim()
    const key = `vault:${vault}/files/${safe}.md`
    if (lsGet(key) !== null) return { ok: false, error: '同名文件已存在' }
    if (!lsSet(key, JSON.stringify({ content: `# ${safe}\n\n` }))) return { ok: false, error: '文件创建失败' }
    return { ok: true, path: key, name: `${safe}.md` }
  },

  async saveConflictCopy(vault: string | null, source: string, name: string, content: string) {
    if (!vault || !source.startsWith(`vault:${vault}/files/`)) return { ok: false, error: '请先打开资料库' }
    const ext = name.match(/\.(md|markdown|txt)$/i)?.[0]
    if (!ext || /[\\/:*?"<>|]/.test(name)) return { ok: false, error: '文件名无效' }
    const stem = name.slice(0, -ext.length)
    for (let i = 1; i <= 999; i++) {
      const fileName = `${stem}${i === 1 ? '' : ` ${i}`}${ext}`
      const path = `vault:${vault}/files/${fileName}`
      if (lsGet(path) !== null) continue
      if (!lsSet(path, JSON.stringify({ content }))) return { ok: false, error: '副本保存失败' }
      return { ok: true, path, name: fileName }
    }
    return { ok: false, error: '副本文件名已用尽' }
  },

  async deleteFile(p: string) {
    const raw = lsGet(p)
    if (raw === null) return false
    const filesAt = p.lastIndexOf('/files/')
    if (!p.startsWith('vault:') || filesAt < 0) return false
    const vault = p.slice('vault:'.length, filesAt)
    const name = p.slice(filesAt + '/files/'.length)
    const prefix = 'trash/' + encodeURIComponent(vault) + '/'
    let time = Date.now()
    let trashKey: string
    do {
      trashKey = prefix + new Date(time++).toISOString().replace(/[:.]/g, '-') + '-' + name
    } while (lsGet(trashKey) !== null)
    if (!lsSet(trashKey, raw)) return false
    return lsRemove(p)
  },

  async listTrash(vault: string) {
    const prefix = 'inkwell:trash/' + encodeURIComponent(vault) + '/'
    const legacyPrefix = 'inkwell:trash/'
    try {
      const out: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k?.startsWith(prefix)) out.push(k.slice(prefix.length))
        else if (k?.startsWith(legacyPrefix) && !k.slice(legacyPrefix.length).includes('/')) {
          // Old trash records did not store a vault; keep them available for recovery.
          out.push(k.slice(legacyPrefix.length))
        }
      }
      return out.sort().reverse()
    } catch { return [] }
  },

  async restoreTrash(vault: string, name: string) {
    const scopedKey = 'trash/' + encodeURIComponent(vault) + '/' + name
    const trashKey = lsGet(scopedKey) !== null ? scopedKey : 'trash/' + name
    const raw = lsGet(trashKey)
    if (raw === null) return { ok: false, error: '不存在' }
    const orig = name.replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-/, '')
    const target = 'vault:' + vault + '/files/' + orig
    if (lsGet(target) !== null) return { ok: false, error: '同名文件已存在' }
    if (!lsSet(target, raw)) return { ok: false, error: '文件恢复失败' }
    if (!lsRemove(trashKey)) return { ok: false, error: '回收站清理失败' }
    return { ok: true, path: target }
  },

  async emptyTrash(vault: string) {
    const prefix = 'inkwell:trash/' + encodeURIComponent(vault) + '/'
    try {
      const kill: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith(prefix)) kill.push(k)
      }
      kill.forEach(k => localStorage.removeItem(k))
      return true
    } catch { return false }
  },

  async renameFile(p: string, newName: string) {
    const raw = lsGet(p)
    if (raw === null) return { ok: false, error: '文件不存在' }
    const safe = newName.replace(/[\\/:*?"<>|]/g, '-').trim()
    const dir = p.slice(0, p.lastIndexOf('/files/') + 7)
    const target = `${dir}${safe}.md`
    if (target === p) return { ok: true, path: p }
    if (lsGet(target) !== null) return { ok: false, error: '同名文件已存在' }
    if (!lsSet(target, raw)) return { ok: false, error: '文件重命名失败' }
    if (!lsRemove(p)) return { ok: false, error: '原文件删除失败' }
    return { ok: true, path: target }
  },

  async exportFile(defaultName: string, html: string) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
    a.download = defaultName
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    return defaultName
  },

  async exportPdf(html: string) {
    // no printToPDF in browsers: open the document and hand it to the system print dialog
    const w = window.open('', '_blank')
    if (!w) return null
    w.document.write(html)
    w.document.close()
    return 'print'
  }
}

declare global {
  interface Window { inkwell?: InkwellApi }
}

export const api: InkwellApi = window.inkwell ?? webApi
