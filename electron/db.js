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

    // 3. Table Examen (Ajout de sujetPdfBase64 et instructions)
    db.run(`
      CREATE TABLE IF NOT EXISTS Examen (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titre TEXT,
        enonceTexte TEXT,
        langageCible TEXT,
        dureeMinutes INTEGER,
        instructions TEXT,
        sujetPdfBase64 TEXT
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
          db.run("INSERT INTO Utilisateur (matricule, nom, prenom, typeUtilisateur, motDePasse, email) VALUES ('DEV_001', 'Test', 'Etudiant', 'Etudiant', 'PASS123', 'student@test.com')");
          // Créer un examen
          db.run("INSERT INTO Examen (titre, langageCible, dureeMinutes, instructions) VALUES ('Examen Test', 'Java', 120, 'Veuillez composer calmement.')");
          // Créer une session
          db.run("INSERT INTO SessionExamen (codeAccesSecret, examen_id) VALUES ('1234', 1)");
          // Créer la copie liée
          db.run("INSERT INTO Copie (etudiant_id, session_id, contenuCode, fluxUML) VALUES (1, 1, '', '')");
        });
      }
    });
  });
}

// Récupérer toutes les sessions d'examen
export function getSessionsFromDb() {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT s.id, s.codeAccesSecret as code, e.titre as title, s.dateHeureDebut as date, 
             e.dureeMinutes as duree, e.instructions, e.langageCible, e.sujetPdfBase64
      FROM SessionExamen s
      JOIN Examen e ON s.examen_id = e.id
    `, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Créer une session et son examen associé
export function createSessionInDb(sessionData) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(
        `INSERT INTO Examen (titre, langageCible, dureeMinutes, instructions, sujetPdfBase64) VALUES (?, ?, ?, ?, ?)`,
        [sessionData.title, sessionData.langageCible || 'Java', sessionData.duree || 120, sessionData.instructions || '', sessionData.sujetPdfBase64 || null],
        function (err) {
          if (err) return reject(err);
          const examenId = this.lastID;

          db.run(
            `INSERT INTO SessionExamen (codeAccesSecret, examen_id, dateHeureDebut) VALUES (?, ?, ?)`,
            [sessionData.code, examenId, sessionData.date],
            function (err2) {
              if (err2) reject(err2);
              else resolve({ success: true, sessionId: this.lastID });
            }
          );
        }
      );
    });
  });
}

// Mettre à jour le sujet PDF
export function updateSessionPdfInDb(sessionId, pdfBase64) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE Examen SET sujetPdfBase64 = ? WHERE id = (SELECT examen_id FROM SessionExamen WHERE id = ?)`,
      [pdfBase64, sessionId],
      function (err) {
        if (err) reject(err);
        else resolve({ success: true });
      }
    );
  });
}

// Importer les étudiants d'un fichier Excel/CSV
export function importStudentsToDb(sessionId, students) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      let completed = 0;
      let hasError = false;

      if (students.length === 0) {
        resolve({ success: true, count: 0 });
        return;
      }

      students.forEach((student) => {
        // Insérer ou mettre à jour l'utilisateur
        db.run(
          `INSERT INTO Utilisateur (matricule, nom, prenom, email, motDePasse, typeUtilisateur) 
           VALUES (?, ?, ?, ?, ?, 'Etudiant')
           ON CONFLICT(matricule) DO UPDATE SET nom=excluded.nom, prenom=excluded.prenom, email=excluded.email, motDePasse=excluded.motDePasse`,
          [student.matricule, student.nom, student.prenom, student.email, student.codeSecret],
          function (err) {
            if (err) {
              hasError = true;
              return reject(err);
            }

            // Récupérer l'id de l'étudiant
            db.get(`SELECT id FROM Utilisateur WHERE matricule = ?`, [student.matricule], (errGet, row) => {
              if (errGet || !row) {
                hasError = true;
                return reject(errGet || new Error("Utilisateur introuvable après insertion"));
              }
              
              const studentId = row.id;

              // Créer une copie pour cet étudiant et cette session s'il n'en a pas déjà une
              db.run(
                `INSERT INTO Copie (etudiant_id, session_id, contenuCode, fluxUML) 
                 SELECT ?, ?, '', '' WHERE NOT EXISTS (SELECT 1 FROM Copie WHERE etudiant_id = ? AND session_id = ?)`,
                [studentId, sessionId, studentId, sessionId],
                function (errCopie) {
                  if (errCopie) {
                    hasError = true;
                    return reject(errCopie);
                  }
                  completed++;
                  if (completed === students.length && !hasError) {
                    resolve({ success: true, count: completed });
                  }
                }
              );
            });
          }
        );
      });
    });
  });
}

// Récupérer les étudiants inscrits à une session
export function getStudentsForSessionFromDb(sessionId) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT u.id, u.matricule, u.nom, u.prenom, u.email, u.motDePasse as codeSecret, c.id as copieId
      FROM Copie c
      JOIN Utilisateur u ON c.etudiant_id = u.id
      WHERE c.session_id = ?
    `, [sessionId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Connexion étudiant
export function studentLoginCheck(matricule, sessionCode, password) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT u.id as studentId, u.matricule, u.nom, u.prenom, s.id as sessionId, c.id as copieId, e.titre, e.dureeMinutes, e.instructions, e.langageCible, e.sujetPdfBase64
      FROM Utilisateur u
      JOIN Copie c ON c.etudiant_id = u.id
      JOIN SessionExamen s ON c.session_id = s.id
      JOIN Examen e ON s.examen_id = e.id
      WHERE u.matricule = ? AND s.codeAccesSecret = ? AND u.motDePasse = ?
    `, [matricule, sessionCode, password], (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

// Mettre à jour le code en temps réel sur la copie de l'étudiant
export function saveCodeToDb(code, copieId = 1) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE Copie SET contenuCode = ?, horodatageDerniereModif = CURRENT_TIMESTAMP WHERE id = ?`,
      [code, copieId],
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
