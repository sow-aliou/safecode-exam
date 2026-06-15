const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveCode: (code) => ipcRenderer.invoke('save-code', code),
});
