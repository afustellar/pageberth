import { app, BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { autoUpdater } from 'electron-updater'
import * as fs from 'fs'
import * as path from 'path'

// Keep the existing profile and installer identity when the visible brand changes.
if (!app.commandLine.hasSwitch('user-data-dir')) {
  const legacyProfile = path.join(app.getPath('appData'), 'Inkwell')
  fs.mkdirSync(legacyProfile, { recursive: true })
  app.setPath('userData', legacyProfile)
}

let win: BrowserWindow | null = null
let lastVersion: string | null = null

function validFileName(name: string): string | null {
  if (typeof name !== 'string') return null
  const safe = name.replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g, '-').trim().replace(/[. ]+$/, '')
  if (!safe || /^\.+$/.test(safe) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(safe)) return null
  return safe
}

function errorCode(err: unknown): string | undefined {
  return err && typeof err === 'object' && 'code' in err && typeof err.code === 'string' ? err.code : undefined
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// Exclusive hard links are cheap; exFAT/FAT volumes need an exclusive copy instead.
function moveFileWithoutReplace(src: string, dest: string): void {
  if (!fs.lstatSync(src).isFile()) throw new Error('源文件不是普通文件')
  try {
    fs.linkSync(src, dest)
  } catch (err) {
    if (!['EPERM', 'EACCES', 'ENOTSUP', 'EOPNOTSUPP', 'ENOSYS'].includes(errorCode(err) || '')) throw err
    fs.copyFileSync(src, dest, fs.constants.COPYFILE_EXCL)
  }
  try {
    fs.unlinkSync(src)
  } catch (err) {
    fs.unlinkSync(dest)
    throw err
  }
}

function trashDirectory(vault: string): string {
  const trash = path.join(vault, '.trash')
  if (fs.existsSync(trash) && !fs.lstatSync(trash).isDirectory()) throw new Error('回收站不是文件夹')
  return trash
}

function openExternalLink(url: string): void {
  try {
    if (!['https:', 'http:', 'mailto:'].includes(new URL(url).protocol)) return
    void shell.openExternal(url).catch(() => {})
  } catch { /* malformed links are ignored */ }
}

let activeVault: string | null = null
const sessionVaults = new Set<string>()
const looseFiles = new Set<string>()
let watchedVault: string | null = null
let vaultWatcher: fs.FSWatcher | null = null

function stopVaultWatcher(): void {
  vaultWatcher?.close()
  vaultWatcher = null
  watchedVault = null
}

app.on('before-quit', stopVaultWatcher)

function vaultPath(dir: unknown): string | null {
  if (typeof dir !== 'string' || !path.isAbsolute(dir)) return null
  try {
    const real = fs.realpathSync.native(dir)
    return fs.statSync(real).isDirectory() ? real : null
  } catch { return null }
}

function grantVault(dir: string): string | null {
  const real = vaultPath(dir)
  if (!real) return null
  try {
    const store = app.getPath('userData')
    fs.mkdirSync(store, { recursive: true })
    fs.writeFileSync(path.join(store, 'last-vault-path'), real, 'utf-8')
    activeVault = real
    sessionVaults.add(real)
    return real
  } catch { return null }
}

function restoreVaultGrant(): void {
  try {
    activeVault = vaultPath(fs.readFileSync(path.join(app.getPath('userData'), 'last-vault-path'), 'utf-8'))
  } catch { activeVault = null }
  if (activeVault) sessionVaults.add(activeVault)
}

function trustedSender(event: IpcMainInvokeEvent): boolean {
  return !!win && event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame
}

function grantedVault(dir: unknown): dir is string {
  const real = vaultPath(dir)
  return real !== null && sessionVaults.has(real)
}

function grantedFile(file: unknown): file is string {
  if (typeof file !== 'string' || !path.isAbsolute(file) || !/\.(md|markdown|txt)$/i.test(file)) return false
  if (validFileName(path.basename(file)) !== path.basename(file)) return false
  try {
    if (!fs.lstatSync(file).isFile()) return false
    const real = fs.realpathSync.native(file)
    return sessionVaults.has(path.dirname(real)) || looseFiles.has(real)
  } catch { return false }
}

function grantOpenedFile(file: string): string | null {
  if (typeof file !== 'string' || !path.isAbsolute(file) || !/\.(md|markdown|txt)$/i.test(file)) return null
  try {
    if (!fs.lstatSync(file).isFile()) return null
    const real = fs.realpathSync.native(file)
    if (validFileName(path.basename(real)) !== path.basename(real)) return null
    return real
  } catch { return null }
}

function createWindow() {
  const useFrameless = process.platform === 'win32'
  win = new BrowserWindow({
    width: 1240,
    height: 800,
    minWidth: 860,
    minHeight: 560,
    title: 'Pageberth',
    backgroundColor: '#17161B',
    autoHideMenuBar: true,
    ...(useFrameless
      ? {
          frame: false,
          titleBarStyle: 'hidden',
          icon: path.join(__dirname, '..', 'dist', 'pageberth.png')
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
    openExternalLink(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (url.split('#')[0] === win?.webContents.getURL().split('#')[0]) return
    event.preventDefault()
    openExternalLink(url)
  })
  // Windows "open with" passes the file path as argv[1] (packaged) / argv[1:] (dev)
  const argFile = process.argv.find(a => /\.(md|markdown|txt)$/i.test(a))
  const openedFile = argFile && grantOpenedFile(argFile)
  if (openedFile && grantVault(path.dirname(openedFile))) {
    win.webContents.on('did-finish-load', () => {
      win?.webContents.executeJavaScript('window.__inkOpenFile = true')
      win?.webContents.send('ink:open-file', openedFile)
    })
  }
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_e, argv) => {
    if (win) {
      win.restore()
      const f = argv.find(a => /\.(md|markdown|txt)$/i.test(a))
      const openedFile = f && grantOpenedFile(f)
      if (openedFile && grantVault(path.dirname(openedFile))) win.webContents.send('ink:open-file', openedFile)
    }
  })
  app.whenReady().then(() => {
    restoreVaultGrant()
  createWindow()
  // auto-update: only meaningful in packaged builds
  if (app.isPackaged) {
    autoUpdater.autoDownload = true
    autoUpdater.checkForUpdates().catch(() => {})
    autoUpdater.on('update-available', (info) => {
      win?.webContents.send('ink:update', info.version)
    })
    autoUpdater.on('download-progress', (p) => {
      win?.webContents.send('ink:update-progress', { percent: p.percent, bps: p.bytesPerSecond })
    })
    autoUpdater.on('update-downloaded', () => {
      win?.webContents.send('ink:update-ready')
    })
  }
})
}
app.on('window-all-closed', () => app.quit())

ipcMain.on('ink:winControl', (_e, action: string) => {
  if (!win) return
  if (action === 'minimize') win.minimize()
  else if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize()
  else if (action === 'close') win.close()
})
ipcMain.handle('ink:isMaximized', () => (win ? win.isMaximized() : false))
ipcMain.handle('ink:checkUpdate', async () => {
  if (!app.isPackaged) return { dev: true }
  const current = app.getVersion()
  try {
    const r = await autoUpdater.checkForUpdates()
    const v = r?.updateInfo.version || null
    return { version: v && v !== current ? v : null, current, downloaded: !!lastVersion }
  } catch {
    return { version: lastVersion || null, current, downloaded: !!lastVersion, error: 'network' }
  }
})
ipcMain.handle('ink:downloadUpdate', async () => {
  try { await autoUpdater.downloadUpdate(); return true } catch { return false }
})
ipcMain.on('ink:installUpdate', () => autoUpdater.quitAndInstall())

ipcMain.handle('ink:getLastVault', (e) => trustedSender(e) ? activeVault : null)

ipcMain.handle('ink:pickFolder', async (e) => {
  if (!trustedSender(e) || !win) return null
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
  return r.canceled || !r.filePaths[0] ? null : grantVault(r.filePaths[0])
})

ipcMain.handle('ink:watchVault', (e, dir: string) => {
  if (!trustedSender(e) || !grantedVault(dir)) return false
  const real = vaultPath(dir)!
  if (watchedVault === real && vaultWatcher) return true
  stopVaultWatcher()
  try {
    const watcher = fs.watch(real, (_event, name) => {
      win?.webContents.send('ink:vault-changed', real, name?.toString() ?? null, false)
    })
    watcher.on('error', () => {
      if (vaultWatcher !== watcher) return
      stopVaultWatcher()
      win?.webContents.send('ink:vault-changed', real, null, true)
    })
    vaultWatcher = watcher
    watchedVault = real
    return true
  } catch { return false }
})

ipcMain.handle('ink:openFileDialog', async (e) => {
  if (!trustedSender(e) || !win) return null
  const r = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
  })
  if (r.canceled || !r.filePaths[0]) return null
  const p = grantOpenedFile(r.filePaths[0])
  if (!p) return null
  try {
    const stat = fs.statSync(p)
    if (stat.size > 5 * 1024 * 1024) return null
    const content = fs.readFileSync(p, 'utf-8')
    looseFiles.add(p)
    return { path: p, content }
  } catch { return null }
})

ipcMain.handle('ink:readDir', (e, dir: string) => {
  if (!trustedSender(e) || !grantedVault(dir)) return null
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

ipcMain.handle('ink:readFile', (e, p: string) => {
  if (!trustedSender(e) || !grantedFile(p)) return null
  try {
    const stat = fs.statSync(p)
    if (!stat.isFile() || stat.size > 5 * 1024 * 1024) return null
    return fs.readFileSync(p, 'utf-8')
  } catch {
    return null
  }
})

ipcMain.handle('ink:writeFile', (e, p: string, content: string, expected?: string) => {
  if (!trustedSender(e) || !grantedFile(p) || typeof content !== 'string') return { ok: false }
  let tmp: string | undefined
  try {
    const stat = fs.lstatSync(p)
    if (!stat.isFile() || !/\.(md|markdown|txt)$/i.test(p)) return { ok: false }
    if (expected !== undefined && fs.readFileSync(p, 'utf-8') !== expected) return { ok: false, conflict: true }
    // Write a complete replacement before touching the original note.
    tmp = path.join(path.dirname(p), `.${path.basename(p)}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`)
    fs.writeFileSync(tmp, content, { encoding: 'utf-8', flag: 'wx', mode: stat.mode })
    fs.chmodSync(tmp, stat.mode)
    fs.renameSync(tmp, p)
    return { ok: true }
  } catch {
    return { ok: false }
  } finally {
    if (tmp) {
      try { fs.unlinkSync(tmp) } catch { /* cleanup must not hide the save result */ }
    }
  }
})

ipcMain.handle('ink:createFile', (e, dir: string, name: string) => {
  if (!trustedSender(e) || !grantedVault(dir)) return { ok: false, error: '资料库未授权' }
  try {
    const safe = validFileName(name)
    if (!safe) return { ok: false, error: '文件名无效' }
    const full = /\.md$/i.test(safe) ? safe : `${safe}.md`
    const title = full.slice(0, -3)
    if (!validFileName(title)) return { ok: false, error: '文件名无效' }
    const p = path.join(dir, full)
    fs.writeFileSync(p, `# ${title}\n\n`, { encoding: 'utf-8', flag: 'wx' })
    return { ok: true, path: p, name: full }
  } catch (err: unknown) {
    return { ok: false, error: errorCode(err) === 'EEXIST' ? '同名文件已存在' : errorMessage(err) }
  }
})

ipcMain.handle('ink:saveConflictCopy', async (e, vault: string | null, source: string, name: string, content: string) => {
  if (!trustedSender(e) || !win || typeof source !== 'string' || typeof content !== 'string' ||
      typeof name !== 'string' || validFileName(name) !== name || !/\.(md|markdown|txt)$/i.test(name)) {
    return { ok: false, error: '副本文件名无效' }
  }
  const ext = path.extname(name)
  const stem = name.slice(0, -ext.length)
  if (vault !== null) {
    if (!grantedVault(vault)) return { ok: false, error: '资料库未授权' }
    const real = vaultPath(vault)!
    if (path.dirname(source).toLowerCase() !== real.toLowerCase()) return { ok: false, error: '源文件不在当前资料库' }
    for (let i = 1; i <= 999; i++) {
      const fileName = `${stem}${i === 1 ? '' : ` ${i}`}${ext}`
      const dest = path.join(real, fileName)
      try {
        fs.writeFileSync(dest, content, { encoding: 'utf-8', flag: 'wx' })
        return { ok: true, path: dest, name: fileName }
      } catch (err: unknown) {
        if (errorCode(err) !== 'EEXIST') return { ok: false, error: errorMessage(err) }
      }
    }
    return { ok: false, error: '副本文件名已用尽' }
  }
  if (!path.isAbsolute(source) || !looseFiles.has(source)) return { ok: false, error: '源文件未授权' }
  const choice = await dialog.showSaveDialog(win, {
    defaultPath: path.join(path.dirname(source), name),
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
  })
  if (choice.canceled || !choice.filePath) return { ok: false, canceled: true }
  const fileName = path.basename(choice.filePath)
  if (validFileName(fileName) !== fileName || !/\.(md|markdown|txt)$/i.test(fileName)) {
    return { ok: false, error: '请选择 Markdown 文件名' }
  }
  try {
    fs.writeFileSync(choice.filePath, content, { encoding: 'utf-8', flag: 'wx' })
    const real = fs.realpathSync.native(choice.filePath)
    looseFiles.add(real)
    return { ok: true, path: real, name: fileName }
  } catch (err: unknown) {
    return { ok: false, error: errorCode(err) === 'EEXIST' ? '目标文件已存在，请换一个名称' : errorMessage(err) }
  }
})

// soft delete: move into <vault>/.trash/ instead of unlinking (recyclable)
ipcMain.handle('ink:deleteFile', (e, p: string) => {
  if (!trustedSender(e) || !grantedFile(p)) return false
  try {
    if (!/\.(md|markdown|txt)$/i.test(p)) return false
    const opened = fs.realpathSync.native(p)
    const vault = path.dirname(p)
    const trash = trashDirectory(vault)
    if (!fs.existsSync(trash)) fs.mkdirSync(trash)
    const time = Date.now()
    let i = 0
    for (;;) {
      const stamp = new Date(time + i).toISOString().replace(/[:.]/g, '-')
      const dest = path.join(trash, `${stamp}-${path.basename(p)}`)
      try {
        moveFileWithoutReplace(p, dest)
        looseFiles.delete(opened)
        return true
      } catch (err: unknown) {
        if (errorCode(err) !== 'EEXIST') throw err
        i++
      }
    }
  } catch {
    return false
  }
})

// list trash contents (newest first)
ipcMain.handle('ink:listTrash', (e, vault: string) => {
  if (!trustedSender(e) || !grantedVault(vault)) return []
  try {
    const trash = trashDirectory(vault)
    if (!fs.existsSync(trash)) return []
    return fs.readdirSync(trash)
      .filter(f => /\.(md|markdown|txt)$/i.test(f) && fs.lstatSync(path.join(trash, f)).isFile())
      .sort()
      .reverse()
  } catch {
    return []
  }
})

// restore: move a trash file back to the vault root
ipcMain.handle('ink:restoreTrash', (e, vault: string, name: string) => {
  if (!trustedSender(e) || !grantedVault(vault)) return { ok: false, error: '资料库未授权' }
  try {
    if (typeof name !== 'string' || !name || name === '.' || name === '..' || /[\\/]/.test(name)) {
      return { ok: false, error: '回收站文件名无效' }
    }
    const orig = name.replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-/, '')
    if (orig === name || !/\.(md|markdown|txt)$/i.test(orig) || validFileName(orig) !== orig) {
      return { ok: false, error: '回收站文件名无效' }
    }
    const src = path.join(trashDirectory(vault), name)
    let dest = path.join(vault, orig)
    let i = 1
    for (;;) {
      try {
        moveFileWithoutReplace(src, dest)
        return { ok: true, path: dest }
      } catch (err: unknown) {
        if (errorCode(err) !== 'EEXIST') throw err
        const ext = path.extname(orig)
        dest = path.join(vault, `${orig.slice(0, -ext.length)}-${i++}${ext}`)
      }
    }
  } catch (err: unknown) {
    return { ok: false, error: errorMessage(err) }
  }
})

// permanently empty the trash
ipcMain.handle('ink:emptyTrash', (e, vault: string) => {
  if (!trustedSender(e) || !grantedVault(vault)) return false
  try {
    const trash = trashDirectory(vault)
    if (fs.existsSync(trash)) fs.rmSync(trash, { recursive: true })
    return true
  } catch {
    return false
  }
})

ipcMain.handle('ink:renameFile', (e, p: string, newName: string) => {
  if (!trustedSender(e) || !grantedFile(p)) return { ok: false, error: '文件未授权' }
  try {
    if (!/\.(md|markdown|txt)$/i.test(p)) return { ok: false, error: '文件类型无效' }
    const safe = validFileName(newName)
    if (!safe) return { ok: false, error: '文件名无效' }
    const ext = path.extname(p) || '.md'
    const target = path.join(path.dirname(p), `${safe}${ext}`)
    const opened = fs.realpathSync.native(p)
    moveFileWithoutReplace(p, target)
    if (looseFiles.delete(opened)) looseFiles.add(fs.realpathSync.native(target))
    return { ok: true, path: target }
  } catch (err: unknown) {
    return { ok: false, error: errorCode(err) === 'EEXIST' ? '同名文件已存在' : errorMessage(err) }
  }
})

ipcMain.handle('ink:writeBinary', async (e, dir: string, name: string, data: Uint8Array) => {
  if (!trustedSender(e) || !grantedVault(dir)) return { ok: false, error: '资料库未授权' }
  try {
    const safe = typeof name === 'string' ? validFileName(name.replace(/[^A-Za-z0-9._-]/g, '-')) : null
    if (!safe || safe !== name) return { ok: false, error: '文件名无效' }
    const assetsDir = path.join(dir, 'assets')
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir)
    if (!fs.lstatSync(assetsDir).isDirectory()) return { ok: false, error: '附件目录无效' }
    const p = path.join(assetsDir, safe)
    fs.writeFileSync(p, data, { flag: 'wx' })
    return { ok: true, path: p }
  } catch (err: unknown) {
    return { ok: false, error: errorCode(err) === 'EEXIST' ? '同名文件已存在' : errorMessage(err) }
  }
})

ipcMain.handle('ink:exportFile', async (e, defaultName: string, html: string) => {
  if (!trustedSender(e) || !win) return null
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

ipcMain.handle('ink:exportPdf', async (e, html: string) => {
  if (!trustedSender(e) || !win) return null
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


