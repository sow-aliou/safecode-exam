import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  saveCodeToDb, 
  getSessionsFromDb, 
  createSessionInDb, 
  updateSessionPdfInDb, 
  importStudentsToDb, 
  getStudentsForSessionFromDb, 
  studentLoginCheck 
} from './db.js';

// Pour gérer les modules ES dans Electron
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    // Kiosk mode pour l'environnement d'examen
    kiosk: false, // Mis à false pour le dev, à mettre à true pour la prod "SAFECODE-EXAM"
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Bloquer des raccourcis spécifiques (Alt+Tab est géré par l'OS mais peut être limité par kiosk: true)
  globalShortcut.register('CommandOrControl+W', () => {
    console.log('Fermeture par raccourci bloquée');
  });

  // Si on est en dev (Vite par défaut sur 5173)
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  // Gérer les IPC
  ipcMain.handle('save-code', async (event, code, copieId) => {
    try {
      const result = await saveCodeToDb(code, copieId);
      return result;
    } catch (error) {
      console.error("Erreur IPC save-code:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-sessions', async () => {
    try {
      const result = await getSessionsFromDb();
      return { success: true, sessions: result };
    } catch (error) {
      console.error("Erreur IPC get-sessions:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('create-session', async (event, sessionData) => {
    try {
      const result = await createSessionInDb(sessionData);
      return result;
    } catch (error) {
      console.error("Erreur IPC create-session:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('update-session-pdf', async (event, sessionId, pdfBase64) => {
    try {
      const result = await updateSessionPdfInDb(sessionId, pdfBase64);
      return result;
    } catch (error) {
      console.error("Erreur IPC update-session-pdf:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('import-students', async (event, sessionId, students) => {
    try {
      const result = await importStudentsToDb(sessionId, students);
      return result;
    } catch (error) {
      console.error("Erreur IPC import-students:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-session-students', async (event, sessionId) => {
    try {
      const result = await getStudentsForSessionFromDb(sessionId);
      return { success: true, students: result };
    } catch (error) {
      console.error("Erreur IPC get-session-students:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('student-login', async (event, matricule, sessionCode, password) => {
    try {
      const result = await studentLoginCheck(matricule, sessionCode, password);
      return { success: true, user: result };
    } catch (error) {
      console.error("Erreur IPC student-login:", error);
      return { success: false, error: error.message };
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
