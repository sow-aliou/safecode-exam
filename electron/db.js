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
        enseignant_id INTEGER,
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
        notesJSON TEXT DEFAULT '{}',
        noteFinale REAL DEFAULT 0,
        commentaire TEXT DEFAULT '',
        dernierPing DATETIME,
        FOREIGN KEY (etudiant_id) REFERENCES Utilisateur(id),
        FOREIGN KEY (session_id) REFERENCES SessionExamen(id)
      )
    `, () => {
      // Pour les bases de données existantes, ajouter les colonnes si elles manquent
      db.run("ALTER TABLE Copie ADD COLUMN notesJSON TEXT DEFAULT '{}'", (err) => {});
      db.run("ALTER TABLE Copie ADD COLUMN noteFinale REAL DEFAULT 0", (err) => {});
      db.run("ALTER TABLE Copie ADD COLUMN commentaire TEXT DEFAULT ''", (err) => {});
      db.run("ALTER TABLE Copie ADD COLUMN dernierPing DATETIME", (err) => {});
    });

    // 6. Table JournalLog
    db.run(`
      CREATE TABLE IF NOT EXISTS JournalLog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER,
        etudiant_id INTEGER,
        horodatage DATETIME DEFAULT CURRENT_TIMESTAMP,
        typeEvenement TEXT,
        description TEXT,
        criticite TEXT,
        FOREIGN KEY (session_id) REFERENCES SessionExamen(id),
        FOREIGN KEY (etudiant_id) REFERENCES Utilisateur(id)
      )
    `, () => {
        db.run("ALTER TABLE JournalLog ADD COLUMN etudiant_id INTEGER REFERENCES Utilisateur(id)", (err) => {});
    });

    // 7. Table BanqueQuestions
    db.run(`
      CREATE TABLE IF NOT EXISTS BanqueQuestions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enseignant_id INTEGER,
        enonce TEXT,
        typeReponse TEXT,
        points INTEGER,
        testCases TEXT DEFAULT '[]'
      )
    `, () => {
      db.run("ALTER TABLE BanqueQuestions ADD COLUMN testCases TEXT DEFAULT '[]'", () => {});
    });

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
export function getSessionsFromDb(teacherId) {
  return new Promise((resolve, reject) => {
    let query = `
      SELECT s.id, s.codeAccesSecret as code, e.titre as title, s.dateHeureDebut as date, 
             e.dureeMinutes as duree, e.instructions, e.langageCible, e.sujetPdfBase64, e.enonceTexte
      FROM SessionExamen s
      JOIN Examen e ON s.examen_id = e.id
    `;
    let params = [];
    if (teacherId) {
      query += ` WHERE e.enseignant_id = ?`;
      params.push(teacherId);
    }
    db.all(query, params, (err, rows) => {
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
        `INSERT INTO Examen (enseignant_id, titre, langageCible, dureeMinutes, instructions, sujetPdfBase64) VALUES (?, ?, ?, ?, ?, ?)`,
        [sessionData.teacherId || null, sessionData.title, sessionData.langageCible || 'Java', sessionData.duree || 120, sessionData.instructions || '', sessionData.sujetPdfBase64 || null],
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

// Mettre à jour l'examen complet
export function updateSessionExamInDb(sessionId, examData) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE Examen SET titre = ?, dureeMinutes = ?, instructions = ?, langageCible = ?, sujetPdfBase64 = ?, enonceTexte = ? WHERE id = (SELECT examen_id FROM SessionExamen WHERE id = ?)`,
      [examData.title, examData.duree, examData.instructions, examData.langageCible, examData.sujetPdfBase64, JSON.stringify(examData.questions), sessionId],
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
      SELECT u.id, u.matricule, u.nom, u.prenom, u.email, '***' as codeSecret, c.id as copieId
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
      SELECT u.id as studentId, u.matricule, u.nom, u.prenom, s.id as sessionId, c.id as copieId, e.titre, e.dureeMinutes, e.instructions, e.langageCible, e.sujetPdfBase64, s.dateHeureDebut
      FROM Utilisateur u
      JOIN Copie c ON c.etudiant_id = u.id
      JOIN SessionExamen s ON c.session_id = s.id
      JOIN Examen e ON s.examen_id = e.id
      WHERE u.matricule = ? AND s.codeAccesSecret = ? AND u.motDePasse = ?
    `, [matricule, sessionCode, password], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!row) {
        resolve(null);
        return;
      }

      if (row.dateHeureDebut) {
        const start = new Date(row.dateHeureDebut);
        const end = new Date(start.getTime() + (row.dureeMinutes || 120) * 60000);
        const now = new Date();
        if (now < start) {
          const formattedStart = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          resolve({ error: `L'épreuve n'a pas encore commencé. Ouverture prévue à ${formattedStart}.` });
          return;
        }
        if (now > end) {
          resolve({ error: "L'épreuve est déjà terminée et l'accès est fermé." });
          return;
        }
      }
      
      resolve(row);
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

// Récupérer la banque de questions d'un enseignant
export function getQuestionBankFromDb(teacherId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM BanqueQuestions WHERE enseignant_id = ?`,
      [teacherId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

// Ajouter une question à la banque
export function addQuestionToBankInDb(teacherId, question) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO BanqueQuestions (enseignant_id, enonce, typeReponse, points, testCases) VALUES (?, ?, ?, ?, ?)`,
      [teacherId, question.enonce, question.typeReponse, question.points, JSON.stringify(question.testCases || [])],
      function (err) {
        if (err) reject(err);
        else resolve({ success: true, id: this.lastID });
      }
    );
  });
}

// Supprimer une question de la banque
export function deleteQuestionFromBankInDb(questionId) {
  return new Promise((resolve, reject) => {
    db.run(
      `DELETE FROM BanqueQuestions WHERE id = ?`,
      [questionId],
      function (err) {
        if (err) reject(err);
        else resolve({ success: true });
      }
    );
  });
}

// Récupérer toutes les copies et résultats pour une session d'examen
export function getResultsForSessionFromDb(sessionId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT u.id as studentId, u.matricule, u.nom, u.prenom, u.email,
              c.id as copieId, c.contenuCode, c.fluxUML, c.estValidee, c.notesJSON, c.noteFinale, c.commentaire, c.horodatageDerniereModif
       FROM Copie c
       JOIN Utilisateur u ON c.etudiant_id = u.id
       WHERE c.session_id = ?`,
      [sessionId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

// Enregistrer la correction d'une copie
export function saveGradeToDb(copieId, notesJSON, noteFinale, commentaire) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE Copie SET notesJSON = ?, noteFinale = ?, commentaire = ? WHERE id = ?`,
      [JSON.stringify(notesJSON), noteFinale, commentaire, copieId],
      function (err) {
        if (err) reject(err);
        else resolve({ success: true });
      }
    );
  });
}

// ================= LIVE TRACKING =================

export function studentPingInDb(copieId, etudiantId, sessionId, alerts) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`UPDATE Copie SET dernierPing = CURRENT_TIMESTAMP WHERE id = ?`, [copieId]);
      
      if (alerts && alerts.length > 0) {
        const stmt = db.prepare(`INSERT INTO JournalLog (session_id, etudiant_id, typeEvenement, description, criticite) VALUES (?, ?, ?, ?, ?)`);
        alerts.forEach(alert => {
          stmt.run([sessionId, etudiantId, alert.type, alert.description, alert.criticite || 'Avertissement']);
        });
        stmt.finalize(err => {
          if (err) reject(err);
          else resolve({ success: true });
        });
      } else {
        resolve({ success: true });
      }
    });
  });
}

export function getLiveStatusFromDb(sessionId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT c.id as copieId, u.id as studentId, u.nom, u.prenom, u.matricule, c.estValidee, c.dernierPing
       FROM Copie c
       JOIN Utilisateur u ON c.etudiant_id = u.id
       WHERE c.session_id = ?`,
      [sessionId],
      (err, students) => {
        if (err) return reject(err);
        
        db.all(
          `SELECT id, etudiant_id, horodatage, typeEvenement, description, criticite 
           FROM JournalLog 
           WHERE session_id = ? ORDER BY horodatage DESC`,
          [sessionId],
          (err2, logs) => {
            if (err2) return reject(err2);
            resolve({ success: true, students, logs });
          }
        );
      }
    );
  });
}

export default db;
