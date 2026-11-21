const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('inkwell', {
  isElectron: true,
  pickFolder: () => ipcRenderer.invoke('ink:pickFolder'),
  openFileDialog: () => ipcRenderer.invoke('ink:openFileDialog'),
  writeBinary: (dir, name, data) => ipcRenderer.invoke('ink:writeBinary', dir, name, data),
  readDir: (dir) => ipcRenderer.invoke('ink:readDir', dir),
  readFile: (p) => ipcRenderer.invoke('ink:readFile', p),
  writeFile: (p, content) => ipcRenderer.invoke('ink:writeFile', p, content),
  createFile: (dir, name) => ipcRenderer.invoke('ink:createFile', dir, name),
  deleteFile: (p) => ipcRenderer.invoke('ink:deleteFile', p),
  listTrash: (vault) => ipcRenderer.invoke('ink:listTrash', vault),
  restoreTrash: (vault, name) => ipcRenderer.invoke('ink:restoreTrash', vault, name),
  emptyTrash: (vault) => ipcRenderer.invoke('ink:emptyTrash', vault),
  getLastUpdate: () => ipcRenderer.invoke('ink:getLastUpdate'),
  checkUpdate: () => ipcRenderer.invoke('ink:checkUpdate'),
  downloadUpdate: () => ipcRenderer.invoke('ink:downloadUpdate'),
  installUpdate: () => ipcRenderer.send('ink:installUpdate'),
  onUpdate: (cb) => ipcRenderer.on('ink:update', (_e, v) => cb(v)),
  onUpdateProgress: (cb) => ipcRenderer.on('ink:update-progress', (_e, p) => cb(p)),
  onUpdateReady: (cb) => ipcRenderer.on('ink:update-ready', () => cb()),
  onOpenFile: (cb) => ipcRenderer.on('ink:open-file', (_e, p) => cb(p)),
  renameFile: (p, newName) => ipcRenderer.invoke('ink:renameFile', p, newName),
  exportFile: (defaultName, html) => ipcRenderer.invoke('ink:exportFile', defaultName, html),
  exportPdf: (html) => ipcRenderer.invoke('ink:exportPdf', html),
  winControl: (action) => ipcRenderer.send('ink:winControl', action),
  isMaximized: () => ipcRenderer.invoke('ink:isMaximized')
})
