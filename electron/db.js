import sqlite3 from 'sqlite3';
import path from 'path';
import { app } from 'electron';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const dbPath = isDev 
  ? path.join(process.cwd(), 'exam_backup.sqlite') 
  : path.join(app.getPath('userData'), 'exam_backup.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erreur lors de la connexion à la base SQLite :', err.message);
  } else {
    console.log('Connecté à la base de données SQLite.');
    initDb();
  }
});

function initDb() {
  db.serialize(() => {
    // 1. Table Utilisateur (Héritage pour Etudiant et Enseignant)
    db.run(`
      CREATE TABLE IF NOT EXISTS Utilisateur (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        matricule TEXT UNIQUE,
        nom TEXT,
        prenom TEXT,
        motDePasse TEXT,
        email TEXT,
        typeUtilisateur TEXT, -- 'Etudiant' ou 'Enseignant'
        niveauEtude TEXT,     -- Spécifique Etudiant
        groupe TEXT,          -- Spécifique Etudiant
        specialite TEXT,      -- Spécifique Enseignant
        grade TEXT            -- Spécifique Enseignant
      )
    `);

    // 2. Table SalleMachine
    db.run(`
      CREATE TABLE IF NOT EXISTS SalleMachine (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nomSalle TEXT,
        blocBatiment TEXT,
        nbrPostesDispo INTEGER
      )
    `);

    // 3. Table Examen
    db.run(`
      CREATE TABLE IF NOT EXISTS Examen (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titre TEXT,
        enonceTexte TEXT,
        langageCible TEXT,
        dureeMinutes INTEGER
      )
    `);

    // 4. Table SessionExamen
    db.run(`
      CREATE TABLE IF NOT EXISTS SessionExamen (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dateHeureDebut DATETIME,
        codeAccesSecret TEXT,
        estCloturee BOOLEAN DEFAULT 0,
        salle_id INTEGER,
        examen_id INTEGER,
        FOREIGN KEY (salle_id) REFERENCES SalleMachine(id),
        FOREIGN KEY (examen_id) REFERENCES Examen(id)
      )
    `);

    // 5. Table Copie (Classe d'association entre Etudiant et SessionExamen)
    db.run(`
      CREATE TABLE IF NOT EXISTS Copie (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        etudiant_id INTEGER,
        session_id INTEGER,
        contenuCode TEXT,
        fluxUML BLOB,
        horodatageDerniereModif DATETIME DEFAULT CURRENT_TIMESTAMP,
        estValidee BOOLEAN DEFAULT 0,
        FOREIGN KEY (etudiant_id) REFERENCES Utilisateur(id),
        FOREIGN KEY (session_id) REFERENCES SessionExamen(id)
      )
    `);

    // 6. Table JournalLog
    db.run(`
      CREATE TABLE IF NOT EXISTS JournalLog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER,
        horodatage DATETIME DEFAULT CURRENT_TIMESTAMP,
        typeEvenement TEXT,
        description TEXT,
        criticite TEXT,
        FOREIGN KEY (session_id) REFERENCES SessionExamen(id)
      )
    `);

    // Initialisation d'une session de test pour l'interface de développement
    db.get("SELECT id FROM Utilisateur WHERE matricule = 'DEV_001'", (err, row) => {
      if (!row) {
        db.serialize(() => {
          // Créer un étudiant de test
          db.run("INSERT INTO Utilisateur (matricule, nom, prenom, typeUtilisateur) VALUES ('DEV_001', 'Test', 'Etudiant', 'Etudiant')");
          // Créer un examen
          db.run("INSERT INTO Examen (titre, langageCible) VALUES ('Examen Test', 'Java')");
          // Créer une session
          db.run("INSERT INTO SessionExamen (codeAccesSecret, examen_id) VALUES ('1234', 1)");
          // Créer la copie liée
          db.run("INSERT INTO Copie (etudiant_id, session_id, contenuCode, fluxUML) VALUES (1, 1, '', '')");
        });
      }
    });
  });
}

// Mettre à jour le code en temps réel sur la copie de l'étudiant
export function saveCodeToDb(code) {
  return new Promise((resolve, reject) => {
    // Pour le test, on met à jour la copie ID 1
    db.run(
      `UPDATE Copie SET contenuCode = ?, horodatageDerniereModif = CURRENT_TIMESTAMP WHERE id = 1`,
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
