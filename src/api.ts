export interface InkwellApi {
  isElectron: boolean
  pickFolder(): Promise<string | null>
  readDir(dir: string): Promise<{ files: string[]; folders: string[] } | null>
  readFile(p: string): Promise<string | null>
  writeFile(p: string, content: string): Promise<boolean>
  createFile(dir: string, name: string): Promise<{ ok: boolean; path?: string; name?: string; error?: string }>
  deleteFile(p: string): Promise<boolean>
  renameFile(p: string, newName: string): Promise<{ ok: boolean; path?: string; error?: string }>
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
    const raw = lsGet('vault:' + vault)
    if (!raw) return null
    const files = Object.keys(JSON.parse(raw).files).sort((a: string, b: string) => a.localeCompare(b, 'zh'))
    return { files, folders: [] }
  },

  async readFile(p: string) {
    const raw = lsGet('vault:' + p)
    return raw ? JSON.parse(raw).content : null
  },

  async writeFile(p: string, content: string) {
    const raw = lsGet('vault:' + p)
    if (!raw) return false
    const entry = JSON.parse(raw)
    entry.content = content
    lsSet('vault:' + p, JSON.stringify(entry))
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
    const raw = lsGet('vault:' + p)
    if (!raw) return false
    try { localStorage.removeItem('inkwell:' + p) } catch { return false }
    return true
  },

  async renameFile(p: string, newName: string) {
    const raw = lsGet('vault:' + p)
    if (!raw) return { ok: false, error: '文件不存在' }
    const safe = newName.replace(/[\\/:*?"<>|]/g, '-').trim()
    const dir = p.slice(0, p.lastIndexOf('/files/') + 7)
    const target = `${dir}${safe}.md`
    if (lsGet(target)) return { ok: false, error: '同名文件已存在' }
    lsSet(target, raw)
    try { localStorage.removeItem('inkwell:' + p) } catch { /* ignore */ }
    return { ok: true, path: target }
  }
}

declare global {
  interface Window { inkwell?: InkwellApi }
}

export const api: InkwellApi = window.inkwell ?? webApi
