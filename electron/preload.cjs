const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveCode: (code, copieId) => ipcRenderer.invoke('save-code', code, copieId),
  getSessions: (teacherId) => ipcRenderer.invoke('get-sessions', teacherId),
  createSession: (sessionData) => ipcRenderer.invoke('create-session', sessionData),
  updateSessionExam: (sessionId, examData) => ipcRenderer.invoke('update-session-exam', sessionId, examData),
  importStudents: (sessionId, students) => ipcRenderer.invoke('import-students', sessionId, students),
  getSessionStudents: (sessionId) => ipcRenderer.invoke('get-session-students', sessionId),
  studentLogin: (matricule, sessionCode, password) => ipcRenderer.invoke('student-login', matricule, sessionCode, password),
  getQuestionBank: (teacherId) => ipcRenderer.invoke('get-question-bank', teacherId),
  addQuestionBank: (teacherId, question) => ipcRenderer.invoke('add-question-bank', teacherId, question),
  deleteQuestionBank: (questionId) => ipcRenderer.invoke('delete-question-bank', questionId),
  getSessionResults: (sessionId) => ipcRenderer.invoke('get-session-results', sessionId),
  saveGrade: (copieId, notesJSON, noteFinale, commentaire) => ipcRenderer.invoke('save-grade', copieId, notesJSON, noteFinale, commentaire),
  sendEmail: (studentData, sessionCode) => ipcRenderer.invoke('send-email', studentData, sessionCode),
});
