import sqlite3 from 'sqlite3';
import path from 'path';
import { app } from 'electron';

// Dans une application Electron en production, on sauvegarde généralement 
// dans le dossier userData pour avoir les permissions d'écriture.
// Pour le développement, on peut utiliser un fichier local dans le projet.
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const dbPath = isDev 
  ? path.join(process.cwd(), 'exam_backup.sqlite') 
  : path.join(app.getPath('userData'), 'exam_backup.sqlite');

// Initialiser la base de données
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erreur lors de la connexion à la base SQLite :', err.message);
  } else {
    console.log('Connecté à la base de données SQLite (sauvegarde locale).');
    initDb();
  }
});

// Créer la table si elle n'existe pas
function initDb() {
  db.run(`
    CREATE TABLE IF NOT EXISTS exam_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matricule TEXT,
      code_content TEXT,
      uml_content TEXT,
      last_saved DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Erreur lors de la création de la table :', err.message);
    } else {
      // S'assurer qu'il y a au moins une ligne d'examen en cours
      db.get("SELECT id FROM exam_sessions LIMIT 1", (err, row) => {
        if (!row) {
          db.run("INSERT INTO exam_sessions (matricule, code_content, uml_content) VALUES ('ETUDIANT_TEST', '', '')");
        }
      });
    }
  });
}

// Mettre à jour le code en temps réel
export function saveCodeToDb(code) {
  return new Promise((resolve, reject) => {
    // On met à jour la première ligne (session en cours)
    db.run(
      `UPDATE exam_sessions SET code_content = ?, last_saved = CURRENT_TIMESTAMP WHERE id = (SELECT MIN(id) FROM exam_sessions)`,
      [code],
      function (err) {
        if (err) {
          console.error("Erreur de sauvegarde SQLite :", err.message);
          reject(err);
        } else {
          resolve({ success: true, changes: this.changes });
        }
      }
    );
  });
}

export default db;
