import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

let win: BrowserWindow | null = null

function createWindow() {
  const useFrameless = process.platform === 'win32'
  win = new BrowserWindow({
    width: 1240,
    height: 800,
    minWidth: 860,
    minHeight: 560,
    title: 'Inkwell',
    backgroundColor: '#17161B',
    autoHideMenuBar: true,
    ...(useFrameless
      ? {
          frame: false,
          titleBarStyle: 'hidden',
          icon: path.join(__dirname, '..', 'public', 'inkwell.png')
        }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  const devUrl = process.env.INKWELL_DEV_URL
  const distIndex = path.join(__dirname, '..', 'dist', 'index.html')
  if (devUrl) {
    win.loadURL(devUrl)
  } else if (fs.existsSync(distIndex)) {
    win.loadFile(distIndex)
  } else {
    win.loadFile(path.join(__dirname, 'index.html'))
  }
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())

ipcMain.on('ink:winControl', (_e, action: string) => {
  if (!win) return
  if (action === 'minimize') win.minimize()
  else if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize()
  else if (action === 'close') win.close()
})
ipcMain.handle('ink:isMaximized', () => (win ? win.isMaximized() : false))

ipcMain.handle('ink:pickFolder', async () => {
  if (!win) return null
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
  return r.canceled ? null : r.filePaths[0]
})

ipcMain.handle('ink:openFileDialog', async () => {
  if (!win) return null
  const r = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
  })
  if (r.canceled || !r.filePaths[0]) return null
  const p = r.filePaths[0]
  try {
    const stat = fs.statSync(p)
    if (!stat.isFile() || stat.size > 5 * 1024 * 1024) return null
    return { path: p, content: fs.readFileSync(p, 'utf-8') }
  } catch {
    return null
  }
})

ipcMain.handle('ink:readDir', (_e, dir: string) => {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const files = entries
      .filter(e => e.isFile() && /\.(md|markdown|txt)$/i.test(e.name))
      .map(e => e.name)
      .sort((a, b) => a.localeCompare(b, 'zh'))
    const folders = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => e.name)
      .sort((a, b) => a.localeCompare(b, 'zh'))
    return { files, folders }
  } catch {
    return null
  }
})

ipcMain.handle('ink:readFile', (_e, p: string) => {
  try {
    const stat = fs.statSync(p)
    if (!stat.isFile() || stat.size > 5 * 1024 * 1024) return null
    return fs.readFileSync(p, 'utf-8')
  } catch {
    return null
  }
})

ipcMain.handle('ink:writeFile', (_e, p: string, content: string) => {
  try {
    fs.writeFileSync(p, content, 'utf-8')
    return true
  } catch {
    return false
  }
})

ipcMain.handle('ink:createFile', (_e, dir: string, name: string) => {
  try {
    const safe = name.replace(/[\\/:*?"<>|]/g, '-').trim()
    const full = `${safe}.md`.replace(/\.md\.md$/i, '.md')
    const p = path.join(dir, full)
    if (fs.existsSync(p)) return { ok: false, error: '同名文件已存在' }
    fs.writeFileSync(p, `# ${safe}\n\n`, 'utf-8')
    return { ok: true, path: p, name: full }
  } catch (err: any) {
    return { ok: false, error: String(err?.message || err) }
  }
})

ipcMain.handle('ink:deleteFile', (_e, p: string) => {
  try {
    fs.unlinkSync(p)
    return true
  } catch {
    return false
  }
})

ipcMain.handle('ink:renameFile', (_e, p: string, newName: string) => {
  try {
    const safe = newName.replace(/[\\/:*?"<>|]/g, '-').trim()
    const ext = path.extname(p) || '.md'
    const target = path.join(path.dirname(p), `${safe}${ext}`)
    if (fs.existsSync(target)) return { ok: false, error: '同名文件已存在' }
    fs.renameSync(p, target)
    return { ok:true, path: target }
  } catch (err: any) {
    return { ok: false, error: String(err?.message || err) }
  }
})

ipcMain.handle('ink:writeBinary', async (_e, dir: string, name: string, data: Uint8Array) => {
  try {
    const safe = name.replace(/[^A-Za-z0-9._-]/g, '-')
    const assetsDir = path.join(dir, 'assets')
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true })
    const p = path.join(assetsDir, safe)
    fs.writeFileSync(p, Buffer.from(data))
    return { ok: true, path: p }
  } catch (err: any) {
    return { ok: false, error: String(err?.message || err) }
  }
})

ipcMain.handle('ink:exportFile', async (_e, defaultName: string, html: string) => {
  if (!win) return null
  const r = await dialog.showSaveDialog(win, {
    title: '导出 HTML',
    defaultPath: defaultName.endsWith('.html') ? defaultName : `${defaultName}.html`,
    filters: [{ name: 'HTML', extensions: ['html'] }]
  })
  if (r.canceled || !r.filePath) return null
  try {
    fs.writeFileSync(r.filePath, html, 'utf-8')
    return r.filePath
  } catch {
    return null
  }
})

ipcMain.handle('ink:exportPdf', async (_e, html: string) => {
  if (!win) return null
  const r = await dialog.showSaveDialog(win, {
    title: '导出 PDF',
    defaultPath: '导出.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (r.canceled || !r.filePath) return null
  const printWin = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false } })
  try {
    await printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    await printWin.webContents.printToPDF({ printBackground: true, margins: { top: 0.6, bottom: 0.6, left: 0.6, right: 0.6 } })
      .then(buf => fs.promises.writeFile(r.filePath, buf))
    return r.filePath
  } catch {
    return null
  } finally {
    printWin.destroy()
  }
})


