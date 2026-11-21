export interface InkwellApi {
  isElectron: boolean
  pickFolder(): Promise<string | null>
  readDir(dir: string): Promise<{ files: string[]; folders: string[] } | null>
  readFile(p: string): Promise<string | null>
  writeFile(p: string, content: string): Promise<boolean>
  createFile(dir: string, name: string): Promise<{ ok: boolean; path?: string; name?: string; error?: string }>
  deleteFile(p: string): Promise<boolean>
  renameFile(p: string, newName: string): Promise<{ ok: boolean; path?: string; error?: string }>
  exportFile(defaultName: string, html: string): Promise<string | null>
  exportPdf(html: string): Promise<string | null>
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
    const name = prompt('给这个资料库起个名字：', '我的笔记')
    if (!name) return null
    const key = 'vault:' + name
    if (!lsGet(key)) {
      lsSet(key, JSON.stringify({ files: {} }))
    }
    lsSet('lastVault', name)
    return name
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
    try { localStorage.removeItem('inkwell:' + p) } catch { return false }
    return true
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
