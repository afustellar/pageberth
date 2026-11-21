export interface InkwellApi {
  isElectron: boolean
  pickFolder(): Promise<string | null>
  openFileDialog?(): Promise<{ path: string; content: string } | null>
  writeBinary?(dir: string, name: string, data: Uint8Array): Promise<{ ok: boolean; path?: string; error?: string }>
  readDir(dir: string): Promise<{ files: string[]; folders: string[] } | null>
  readFile(p: string): Promise<string | null>
  writeFile(p: string, content: string): Promise<boolean>
  createFile(dir: string, name: string): Promise<{ ok: boolean; path?: string; name?: string; error?: string }>
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
  winControl?(action: 'minimize' | 'maximize' | 'close'): void
  isMaximized?(): Promise<boolean>
}

function lsGet(key: string): string | null {
  try { return localStorage.getItem('inkwell:' + key) } catch { return null }
}
function lsSet(key: string, v: string) {
  try { localStorage.setItem('inkwell:' + key, v) } catch { /* ignore */ }
}

const webApi: InkwellApi = {
  isElectron: false,

  async pickFolder() {
    // prompt() is unavailable under Electron; the app injects window.__inkAsk when it loads
    const ask = (window as any).__inkAsk as ((title: string, initial: string) => Promise<string | null>) | undefined
    const name = ask ? await ask('给这个资料库起个名字：', '我的笔记') : prompt('给这个资料库起个名字：', '我的笔记')
    if (!name) return null
    const key = 'vault:' + name
    if (!lsGet(key)) {
      lsSet(key, JSON.stringify({ files: {} }))
    }
    lsSet('lastVault', name)
    return name
  },

  async writeBinary(dir: string, name: string, data: Uint8Array) {
    // web fallback: base64 data URL in localStorage (small images only)
    try {
      let bin = ''
      for (const b of data) bin += String.fromCharCode(b)
      const b64 = btoa(bin)
      const key = 'vault:' + dir + '/assets/' + name
      lsSet(key, JSON.stringify({ dataUrl: 'data:image/png;base64,' + b64 }))
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

  async writeFile(p: string, content: string) {
    const raw = lsGet(p)
    if (!raw) return false
    const entry = JSON.parse(raw)
    entry.content = content
    lsSet(p, JSON.stringify(entry))
    return true
  },

  async createFile(vault: string, name: string) {
    const safe = name.replace(/[\\/:*?"<>|]/g, '-').trim()
    const key = `vault:${vault}/files/${safe}.md`
    if (lsGet(key)) return { ok: false, error: '同名文件已存在' }
    lsSet(key, JSON.stringify({ content: `# ${safe}\n\n` }))
    return { ok: true, path: key, name: `${safe}.md` }
  },

  async deleteFile(p: string) {
    const raw = lsGet(p)
    if (!raw) return false
    // web recycle bin
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const name = p.split('/').pop() || 'file.md'
    lsSet('trash/' + stamp + '-' + name, raw)
    try { localStorage.removeItem('inkwell:' + p) } catch { return false }
    return true
  },

  async listTrash(vault: string) {
    try {
      const out: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('inkwell:trash/')) out.push(k.slice('inkwell:trash/'.length))
      }
      return out.sort().reverse()
    } catch { return [] }
  },

  async restoreTrash(vault: string, name: string) {
    const raw = lsGet('trash/' + name)
    if (!raw) return { ok: false, error: '不存在' }
    const orig = name.replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-/, '')
    lsSet('vault:' + vault + '/files/' + orig, raw)
    try { localStorage.removeItem('inkwell:trash/' + name) } catch { }
    return { ok: true, path: 'vault:' + vault + '/files/' + orig }
  },

  async emptyTrash() {
    try {
      const kill: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('inkwell:trash/')) kill.push(k)
      }
      kill.forEach(k => localStorage.removeItem(k))
      return true
    } catch { return false }
  },

  async renameFile(p: string, newName: string) {
    const raw = lsGet(p)
    if (!raw) return { ok: false, error: '文件不存在' }
    const safe = newName.replace(/[\\/:*?"<>|]/g, '-').trim()
    const dir = p.slice(0, p.lastIndexOf('/files/') + 7)
    const target = `${dir}${safe}.md`
    if (lsGet(target)) return { ok: false, error: '同名文件已存在' }
    lsSet(target, raw)
    try { localStorage.removeItem('inkwell:' + p) } catch { /* ignore */ }
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
