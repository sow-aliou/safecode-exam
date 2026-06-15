const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveCode: (code, copieId) => ipcRenderer.invoke('save-code', code, copieId),
  getSessions: () => ipcRenderer.invoke('get-sessions'),
  createSession: (sessionData) => ipcRenderer.invoke('create-session', sessionData),
  updateSessionPdf: (sessionId, pdfBase64) => ipcRenderer.invoke('update-session-pdf', sessionId, pdfBase64),
  importStudents: (sessionId, students) => ipcRenderer.invoke('import-students', sessionId, students),
  getSessionStudents: (sessionId) => ipcRenderer.invoke('get-session-students', sessionId),
  studentLogin: (matricule, sessionCode, password) => ipcRenderer.invoke('student-login', matricule, sessionCode, password),
});
