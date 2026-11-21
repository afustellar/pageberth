const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('inkwell', {
  isElectron: true,
  pickFolder: () => ipcRenderer.invoke('ink:pickFolder'),
  openFileDialog: () => ipcRenderer.invoke('ink:openFileDialog'),
  readDir: (dir) => ipcRenderer.invoke('ink:readDir', dir),
  readFile: (p) => ipcRenderer.invoke('ink:readFile', p),
  writeFile: (p, content) => ipcRenderer.invoke('ink:writeFile', p, content),
  createFile: (dir, name) => ipcRenderer.invoke('ink:createFile', dir, name),
  deleteFile: (p) => ipcRenderer.invoke('ink:deleteFile', p),
  renameFile: (p, newName) => ipcRenderer.invoke('ink:renameFile', p, newName),
  exportFile: (defaultName, html) => ipcRenderer.invoke('ink:exportFile', defaultName, html),
  exportPdf: (html) => ipcRenderer.invoke('ink:exportPdf', html),
  winControl: (action) => ipcRenderer.send('ink:winControl', action),
  isMaximized: () => ipcRenderer.invoke('ink:isMaximized')
})
