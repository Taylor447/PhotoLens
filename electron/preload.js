const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('photolens', {
  saveFile: payload => ipcRenderer.invoke('photolens:save-file', payload),
  loadHistory: () => ipcRenderer.invoke('photolens:load-history'),
  saveHistory: value => ipcRenderer.invoke('photolens:save-history', value),
  clearHistory: () => ipcRenderer.invoke('photolens:clear-history'),
  openFiles: () => ipcRenderer.invoke('photolens:open-files'),
  onOpenFiles: callback => ipcRenderer.on('photolens:open-files', (_event, files) => callback(files)),
  onExport: callback => ipcRenderer.on('photolens:export', callback)
});
