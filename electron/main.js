import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

// Configuration du transporteur SMTP Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'sow8.aliou@gmail.com',
    pass: 'irpjmzqmxcxgnmxm ' 
  }
});

import {
  saveCodeToDb,
  getSessionsFromDb,
  createSessionInDb,
  updateSessionExamInDb,
  importStudentsToDb,
  getStudentsForSessionFromDb,
  studentLoginCheck,
  getQuestionBankFromDb,
  addQuestionToBankInDb,
  deleteQuestionFromBankInDb,
  getResultsForSessionFromDb,
  saveGradeToDb
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

  // Si on est en dev (Vite par défaut sur 5174)
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5174');
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
  ipcMain.handle('get-sessions', async (event, teacherId) => {
    try {
      // Essayer de charger depuis le serveur central
      try {
        const url = teacherId ? `${BACKEND_URL}/api/sessions?teacherId=${teacherId}` : `${BACKEND_URL}/api/sessions`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.success) {
          // Facultatif : on pourrait synchroniser les sessions reçues dans la base locale SQLite
          return data;
        }
      } catch (err) {
        console.log("Serveur injoignable, chargement depuis SQLite locale...");
      }

      // Fallback local
      const localResult = await getSessionsFromDb(teacherId);
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

  // Mettre à jour l'examen complet (Serveur + local)
  ipcMain.handle('update-session-exam', async (event, sessionId, examData) => {
    try {
      // 1. Envoyer au serveur central
      try {
        await fetch(`${BACKEND_URL}/api/sessions/${sessionId}/exam`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(examData)
        });
      } catch (err) {
        console.log("Erreur connexion serveur pour l'examen.");
      }

      // 2. Mettre à jour localement
      await updateSessionExamInDb(sessionId, examData);
      return { success: true };
    } catch (error) {
      console.error("Erreur update-session-exam:", error);
      return { success: false, error: error.message };
    }
  });

  // Importer les étudiants (Serveur + local)
  ipcMain.handle('import-students', async (event, sessionId, students) => {
    try {
      let serverSuccess = false;

      // 1. Envoyer au serveur central
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 seconds timeout
        const response = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}/students`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ students }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await response.json();
        serverSuccess = data.success;
      } catch (err) {
        console.log("Erreur connexion serveur pour l'import d'étudiants (Ignoré) :", err.message);
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

  // ================= BANQUE DE QUESTIONS =================
  ipcMain.handle('get-question-bank', async (event, teacherId) => {
    try {
      try {
        const response = await fetch(`${BACKEND_URL}/api/questionbank?teacherId=${teacherId}`);
        const data = await response.json();
        if (data.success) return data;
      } catch (err) {
        console.log("Serveur injoignable, banque de questions locale.");
      }
      const localResult = await getQuestionBankFromDb(teacherId);
      return { success: true, questions: localResult };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('add-question-bank', async (event, teacherId, question) => {
    try {
      try {
        const response = await fetch(`${BACKEND_URL}/api/questionbank`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teacherId, ...question })
        });
        const data = await response.json();
        if (data.success) return data;
      } catch (err) {
        console.log("Serveur injoignable, ajout de question local.");
      }
      const localResult = await addQuestionToBankInDb(teacherId, question);
      return localResult;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('delete-question-bank', async (event, questionId) => {
    try {
      try {
        const response = await fetch(`${BACKEND_URL}/api/questionbank/${questionId}`, {
          method: 'DELETE'
        });
        const data = await response.json();
        if (data.success) return data;
      } catch (err) {
        console.log("Serveur injoignable, suppression de question locale.");
      }
      const localResult = await deleteQuestionFromBankInDb(questionId);
      return localResult;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ================= CORRECTIONS & RESULTATS =================
  ipcMain.handle('get-session-results', async (event, sessionId) => {
    try {
      try {
        const response = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}/results`);
        const data = await response.json();
        if (data.success) return data;
      } catch (err) {
        console.log("Serveur injoignable, résultats locaux.");
      }
      const localResult = await getResultsForSessionFromDb(sessionId);
      return { success: true, results: localResult };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('save-grade', async (event, copieId, notesJSON, noteFinale, commentaire) => {
    try {
      try {
        const response = await fetch(`${BACKEND_URL}/api/copies/${copieId}/grade`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notesJSON, noteFinale, commentaire })
        });
        const data = await response.json();
        if (data.success) return data;
      } catch (err) {
        console.log("Serveur injoignable, correction locale.");
      }
      const localResult = await saveGradeToDb(copieId, notesJSON, noteFinale, commentaire);
      return localResult;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Envoi d'email via Nodemailer
  ipcMain.handle('send-email', async (event, studentData, sessionCode) => {
    try {
      const { nom, prenom, email, matricule, codeSecret } = studentData;

      const mailOptions = {
        from: '"SafeCode Exam" <ton.email.prof@gmail.com>', // TODO: Correspondre avec l'adresse configurée en haut
        to: email,
        subject: `Vos identifiants d'examen SafeCode - Session ${sessionCode}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 10px; border: 1px solid #ddd;">
            <h2 style="color: #10b981; text-align: center;">SafeCode - Accès à l'Examen</h2>
            <p style="font-size: 16px; color: #333;">Bonjour <strong>${prenom} ${nom}</strong>,</p>
            <p style="font-size: 15px; color: #444;">Vous êtes invité(e) à participer à une session d'examen sécurisée sur SafeCode. Voici vos identifiants personnels de connexion :</p>

            <div style="background: #fff; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
              <ul style="list-style: none; padding: 0; margin: 0;">
                <li style="margin-bottom: 10px;">👤 <strong>Numéro Étudiant :</strong> <span style="font-family: monospace; background: #eee; padding: 2px 6px; border-radius: 4px;">${matricule}</span></li>
                <li style="margin-bottom: 10px;">🔑 <strong>Code Secret :</strong> <span style="font-family: monospace; background: #eee; padding: 2px 6px; border-radius: 4px; color: #e11d48; font-weight: bold;">${codeSecret}</span></li>
                <li>📝 <strong>Code de la Session :</strong> <span style="font-family: monospace; background: #eee; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${sessionCode}</span></li>
              </ul>
            </div>

            <p style="font-size: 14px; color: #666;"><em>Veuillez conserver ces informations en lieu sûr et ne pas les partager.</em></p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
            <p style="font-size: 12px; color: #999; text-align: center;">Ceci est un message automatique, merci de ne pas y répondre.</p>
          </div>
        `
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Message sent: %s', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'email:", error);
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
