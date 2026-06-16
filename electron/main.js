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
const BACKEND_URL = 'http://localhost:3000';

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
  // Gérer la sauvegarde du code (Locale + Synchro Serveur)
  ipcMain.handle('save-code', async (event, code, copieId) => {
    try {
      // 1. Sauvegarde locale immédiate (Sécurité offline)
      await saveCodeToDb(code, copieId);

      // 2. Tenter la synchronisation avec le serveur central
      try {
        const response = await fetch(`${BACKEND_URL}/api/copies/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ copieId, answers: JSON.parse(code) })
        });
        const resData = await response.json();
        return { success: true, synced: resData.success };
      } catch (errServer) {
        console.log("Mode Offline : Sauvegarde réussie en local mais serveur injoignable.");
        return { success: true, synced: false };
      }
    } catch (error) {
      console.error("Erreur save-code:", error);
      return { success: false, error: error.message };
    }
  });

  // Récupérer toutes les sessions d'examen (Serveur -> local)
  ipcMain.handle('get-sessions', async () => {
    try {
      // Essayer de charger depuis le serveur central
      try {
        const response = await fetch(`${BACKEND_URL}/api/sessions`);
        const data = await response.json();
        if (data.success) {
          // Facultatif : on pourrait synchroniser les sessions reçues dans la base locale SQLite
          return data;
        }
      } catch (err) {
        console.log("Serveur injoignable, chargement depuis SQLite locale...");
      }

      // Fallback local
      const localResult = await getSessionsFromDb();
      return { success: true, sessions: localResult };
    } catch (error) {
      console.error("Erreur get-sessions:", error);
      return { success: false, error: error.message };
    }
  });

  // Créer une session d'examen (Serveur + local)
  ipcMain.handle('create-session', async (event, sessionData) => {
    try {
      let serverSessionId = null;

      // 1. Tenter l'enregistrement sur le serveur central
      try {
        const response = await fetch(`${BACKEND_URL}/api/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sessionData)
        });
        const data = await response.json();
        if (data.success) {
          serverSessionId = data.sessionId;
        }
      } catch (err) {
        console.log("Erreur de connexion serveur pour create-session, création locale uniquement.");
      }

      // 2. Enregistrement local SQLite
      const localResult = await createSessionInDb(sessionData);
      return { 
        success: true, 
        sessionId: serverSessionId || localResult.sessionId,
        localOnly: !serverSessionId 
      };
    } catch (error) {
      console.error("Erreur create-session:", error);
      return { success: false, error: error.message };
    }
  });

  // Mettre à jour le sujet PDF (Serveur + local)
  ipcMain.handle('update-session-pdf', async (event, sessionId, pdfBase64) => {
    try {
      // 1. Envoyer au serveur central
      try {
        await fetch(`${BACKEND_URL}/api/sessions/${sessionId}/pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfBase64 })
        });
      } catch (err) {
        console.log("Erreur connexion serveur pour PDF.");
      }

      // 2. Mettre à jour localement
      await updateSessionPdfInDb(sessionId, pdfBase64);
      return { success: true };
    } catch (error) {
      console.error("Erreur update-session-pdf:", error);
      return { success: false, error: error.message };
    }
  });

  // Importer les étudiants (Serveur + local)
  ipcMain.handle('import-students', async (event, sessionId, students) => {
    try {
      let serverSuccess = false;

      // 1. Envoyer au serveur central
      try {
        const response = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}/students`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ students })
        });
        const data = await response.json();
        serverSuccess = data.success;
      } catch (err) {
        console.log("Erreur connexion serveur pour l'import d'étudiants.");
      }

      // 2. Enregistrer localement
      const localResult = await importStudentsToDb(sessionId, students);
      return { 
        success: true, 
        count: localResult.count,
        serverSynced: serverSuccess
      };
    } catch (error) {
      console.error("Erreur import-students:", error);
      return { success: false, error: error.message };
    }
  });

  // Récupérer les étudiants inscrits (Serveur -> local)
  ipcMain.handle('get-session-students', async (event, sessionId) => {
    try {
      // 1. Tenter depuis le serveur
      try {
        const response = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}/students`);
        const data = await response.json();
        if (data.success) return data;
      } catch (err) {
        console.log("Erreur serveur pour get-session-students, chargement local.");
      }

      // 2. Fallback local
      const localStudents = await getStudentsForSessionFromDb(sessionId);
      return { success: true, students: localStudents };
    } catch (error) {
      console.error("Erreur get-session-students:", error);
      return { success: false, error: error.message };
    }
  });

  // Connexion de l'étudiant (Vérification serveur + cache local)
  ipcMain.handle('student-login', async (event, matricule, sessionCode, password) => {
    try {
      // 1. Tenter de se connecter via le serveur central
      try {
        const response = await fetch(`${BACKEND_URL}/api/student/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matricule, sessionCode, password })
        });
        const data = await response.json();
        if (data.success && data.user) {
          // Sauvegarder cet étudiant et sa copie en cache local SQLite au cas où internet coupe
          const studentObj = {
            matricule: data.user.matricule,
            nom: data.user.nom,
            prenom: data.user.prenom,
            email: '', // optionnel
            codeSecret: password
          };
          
          await importStudentsToDb(data.user.sessionId, [studentObj]);
          
          return data;
        }
      } catch (err) {
        console.log("Erreur serveur pour student-login. Connexion mode offline via SQLite local...");
      }

      // 2. Fallback local SQLite (si l'élève a déjà été importé localement par le prof)
      const localUser = await studentLoginCheck(matricule, sessionCode, password);
      if (localUser) {
        return { success: true, user: localUser };
      } else {
        return { success: false, error: "Identifiants inconnus localement." };
      }
    } catch (error) {
      console.error("Erreur student-login:", error);
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
