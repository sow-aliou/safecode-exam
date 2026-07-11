const sqlite3 = require('sqlite3');
const path = require('path');
const xlsx = require('xlsx');

const dbPath = path.join(__dirname, 'server_database.db');
const db = new sqlite3.Database(dbPath);

const excelFile = path.join(__dirname, '../liste_etudiants.xlsx');

const workbook = xlsx.readFile(excelFile);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const studentsData = xlsx.utils.sheet_to_json(worksheet);

// Generate random session code
const code = 'NOUVEAU-123';
const title = 'Session de test 3';
const instructions = 'Lisez attentivement le sujet';

db.serialize(() => {
  db.run(
    "INSERT INTO Examen (enseignant_id, titre, instructions, langageCible, dureeMinutes) VALUES (1, ?, ?, 'Java', 120)",
    [title, instructions],
    function(err) {
      if (err) throw err;
      const examId = this.lastID;
      
      db.run(
        "INSERT INTO SessionExamen (codeAccesSecret, dateHeureDebut, examen_id, estCloturee) VALUES (?, datetime('now'), ?, 0)",
        [code, examId],
        function(err2) {
          if (err2) throw err2;
          const sessionId = this.lastID;
          
          let completed = 0;
          studentsData.forEach(student => {
            const codeSecret = Math.random().toString(36).substring(2, 10).toUpperCase();
            db.run(
              "INSERT INTO Utilisateur (matricule, nom, prenom, email, motDePasse, typeUtilisateur) VALUES (?, ?, ?, ?, ?, 'Etudiant') ON CONFLICT(matricule) DO UPDATE SET motDePasse=excluded.motDePasse",
              [student.Matricule || student.matricule, student.Nom || student.nom, student.Prenom || student.prenom, student.Email || student.email, codeSecret],
              function(err3) {
                db.get("SELECT id FROM Utilisateur WHERE matricule = ?", [student.Matricule || student.matricule], (err4, row) => {
                  if (row) {
                    db.run(
                      "INSERT INTO Copie (etudiant_id, session_id, contenuCode, fluxUML) VALUES (?, ?, '', '') ON CONFLICT DO NOTHING",
                      [row.id, sessionId],
                      () => {
                        completed++;
                        if (completed === studentsData.length) {
                           console.log(`Session créée avec succès! Code: ${code}`);
                           console.log("Mots de passe régénérés pour l'accès.");
                        }
                      }
                    );
                  }
                });
              }
            );
          });
        }
      );
    }
  );
});
