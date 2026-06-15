const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Ici nous ajouterons les appels pour SQLite
  // saveCode: (code) => ipcRenderer.invoke('save-code', code),
});
