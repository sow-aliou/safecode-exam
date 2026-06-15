import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { saveCodeToDb } from './db.js';

// Pour gérer les modules ES dans Electron
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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
  // Gérer la sauvegarde du code envoyée par le rendu (React)
  ipcMain.handle('save-code', async (event, code) => {
    try {
      const result = await saveCodeToDb(code);
      return { success: true };
    } catch (error) {
      console.error("Erreur IPC save-code:", error);
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
