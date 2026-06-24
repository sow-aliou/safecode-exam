import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import db from './db.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Augmenté pour supporter l'upload des PDF base64

// Mailer configuration (peut être configuré via variables d'environnement)
// En dev, on log les identifiants dans la console et on renvoie les mails simulés
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: process.env.SMTP_PORT || 587,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

// ================= TEACHER AUTH =================

app.post('/api/teacher/register', (req, res) => {
  const { nom, prenom, email, motDePasse } = req.body;
  if (!email || !motDePasse) {
    return res.status(400).json({ error: "Email et mot de passe requis." });
  }

  db.run(
    `INSERT INTO Utilisateur (nom, prenom, email, motDePasse, typeUtilisateur) VALUES (?, ?, ?, ?, 'Enseignant')`,
    [nom, prenom, email, motDePasse],
    function(err) {
      if (err) {
        return res.status(400).json({ error: "Cet email est déjà enregistré." });
      }
      res.json({ success: true, teacherId: this.lastID });
    }
  );
});

app.post('/api/teacher/login', (req, res) => {
  const { email, motDePasse } = req.body;
  db.get(
    `SELECT * FROM Utilisateur WHERE email = ? AND motDePasse = ? AND typeUtilisateur = 'Enseignant'`,
    [email, motDePasse],
    (err, row) => {
      if (err || !row) {
        return res.status(400).json({ error: "Identifiants incorrects." });
      }
      res.json({ success: true, teacher: { id: row.id, nom: row.nom, prenom: row.prenom, email: row.email } });
    }
  );
});

// ================= SESSIONS & EXAMS =================

// Récupérer toutes les sessions d'un enseignant
app.get('/api/sessions', (req, res) => {
  const teacherId = req.query.teacherId;
  let query = `SELECT s.id, s.codeAccesSecret as code, s.dateHeureDebut as date, e.titre as title, 
            e.dureeMinutes as duree, e.instructions, e.langageCible, e.sujetPdfBase64, e.enonceTexte,
            (SELECT COUNT(*) FROM Copie WHERE session_id = s.id) as totalStudents
     FROM SessionExamen s
     JOIN Examen e ON s.examen_id = e.id`;
  const params = [];

  if (teacherId) {
    query += ` WHERE e.enseignant_id = ?`;
    params.push(teacherId);
  }

  db.all(
    query,
    params,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, sessions: rows });
    }
  );
});

// Créer une session et son épreuve associée
app.post('/api/sessions', (req, res) => {
  const { title, date, code, duree, instructions, langageCible, teacherId } = req.body;

  db.serialize(() => {
    db.run(
      `INSERT INTO Examen (enseignant_id, titre, instructions, langageCible, dureeMinutes) VALUES (?, ?, ?, ?, ?)`,
      [teacherId || 1, title, instructions, langageCible || 'Java', duree || 120],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        const examId = this.lastID;

        db.run(
          `INSERT INTO SessionExamen (codeAccesSecret, dateHeureDebut, examen_id) VALUES (?, ?, ?)`,
          [code, date, examId],
          function(err2) {
            if (err2) {
              return res.status(500).json({ error: err2.message });
            }
            res.json({ success: true, sessionId: this.lastID });
          }
        );
      }
    );
  });
});

// Charger l'épreuve complète d'une session
app.get('/api/sessions/:id/exam', (req, res) => {
  const sessionId = req.params.id;
  db.get(
    `SELECT e.titre as title, e.dureeMinutes as duree, e.instructions, e.langageCible,
            e.sujetPdfBase64, e.enonceTexte, s.dateHeureDebut as date, s.codeAccesSecret as code
     FROM Examen e
     JOIN SessionExamen s ON s.examen_id = e.id
     WHERE s.id = ?`,
    [sessionId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Session introuvable.' });
      res.json({ success: true, exam: row });
    }
  );
});

// Mettre à jour l'épreuve complète (questions, PDF, titre, durée...)
app.post('/api/sessions/:id/exam', (req, res) => {
  const sessionId = req.params.id;
  const { title, duree, instructions, langageCible, sujetPdfBase64, questions } = req.body;

  db.run(
    `UPDATE Examen SET titre = ?, dureeMinutes = ?, instructions = ?, langageCible = ?, sujetPdfBase64 = ?, enonceTexte = ?
     WHERE id = (SELECT examen_id FROM SessionExamen WHERE id = ?)`,
    [title, duree || 120, instructions, langageCible || 'Java', sujetPdfBase64 || null, JSON.stringify(questions || []), sessionId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// Uploader le PDF sujet (legacy)
app.post('/api/sessions/:id/pdf', (req, res) => {
  const sessionId = req.params.id;
  const { pdfBase64 } = req.body;

  db.run(
    `UPDATE Examen SET sujetPdfBase64 = ? WHERE id = (SELECT examen_id FROM SessionExamen WHERE id = ?)`,
    [pdfBase64, sessionId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true });
    }
  );
});

// ================= STUDENTS & EMAILS =================

// Importer et envoyer par email les accès
app.post('/api/sessions/:id/students', async (req, res) => {
  const sessionId = req.params.id;
  const { students } = req.body; // Array de { matricule, nom, prenom, email, codeSecret }

  if (!students || !Array.isArray(students)) {
    return res.status(400).json({ error: "Liste d'étudiants invalide." });
  }

  try {
    db.serialize(() => {
      let completed = 0;
      let errors = [];

      students.forEach((student) => {
        // 1. Insérer ou mettre à jour l'étudiant
        db.run(
          `INSERT INTO Utilisateur (matricule, nom, prenom, email, motDePasse, typeUtilisateur) 
           VALUES (?, ?, ?, ?, ?, 'Etudiant')
           ON CONFLICT(matricule) DO UPDATE SET nom=excluded.nom, prenom=excluded.prenom, email=excluded.email, motDePasse=excluded.motDePasse`,
          [student.matricule, student.nom, student.prenom, student.email, student.codeSecret],
          function(err) {
            if (err) {
              errors.push(`Erreur insertion ${student.matricule}: ${err.message}`);
              return;
            }

            db.get(`SELECT id FROM Utilisateur WHERE matricule = ?`, [student.matricule], (errGet, row) => {
              if (errGet || !row) return;

              const studentId = row.id;

              // 2. Associer l'étudiant à la session (création de copie)
              db.run(
                `INSERT INTO Copie (etudiant_id, session_id, contenuCode, fluxUML) 
                 VALUES (?, ?, '', '')
                 ON CONFLICT(etudiant_id, session_id) DO NOTHING`,
                [studentId, sessionId],
                function(errCopie) {
                  // Simulation d'envoi d'email : Log de sécurité dans la console du serveur
                  console.log(`[EMAIL SEND SIMULATION] TO: ${student.email} | SUBJECT: Vos Accès SAFECODE-EXAM | Matricule: ${student.matricule} | Code Session: ${sessionId} | Code Secret Unique: ${student.codeSecret}`);
                  
                  completed++;
                  if (completed === students.length) {
                    res.json({ success: true, count: completed, errors });
                  }
                }
              );
            });
          }
        );
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Récupérer les étudiants d'une session
app.get('/api/sessions/:id/students', (req, res) => {
  const sessionId = req.params.id;
  db.all(
    `SELECT u.id, u.matricule, u.nom, u.prenom, u.email, u.motDePasse as codeSecret, c.estValidee
     FROM Copie c
     JOIN Utilisateur u ON c.etudiant_id = u.id
     WHERE c.session_id = ?`,
    [sessionId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, students: rows });
    }
  );
});

// ================= STUDENT LOGIN & EXAM =================

app.post('/api/student/login', (req, res) => {
  const { matricule, sessionCode, password } = req.body;

  db.get(
    `SELECT u.id as studentId, u.matricule, u.nom, u.prenom, s.id as sessionId, c.id as copieId, 
            e.titre, e.dureeMinutes, e.instructions, e.langageCible, e.sujetPdfBase64, e.enonceTexte
     FROM Utilisateur u
     JOIN Copie c ON c.etudiant_id = u.id
     JOIN SessionExamen s ON c.session_id = s.id
     JOIN Examen e ON s.examen_id = e.id
     WHERE u.matricule = ? AND s.codeAccesSecret = ? AND u.motDePasse = ?`,
    [matricule, sessionCode, password],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        return res.status(400).json({ error: "Identifiants invalides ou session introuvable." });
      }
      res.json({ success: true, user: row });
    }
  );
});

// ================= COPIES AUTO-SAVE & SUBMIT =================

// Synchronisation des réponses
app.post('/api/copies/sync', (req, res) => {
  const { copieId, answers, fluxUML } = req.body;

  db.run(
    `UPDATE Copie SET contenuCode = ?, fluxUML = ?, horodatageDerniereModif = CURRENT_TIMESTAMP WHERE id = ?`,
    [JSON.stringify(answers), fluxUML || '', copieId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true });
    }
  );
});

// ================= BANQUE DE QUESTIONS =================

// Récupérer la banque de questions d'un enseignant
app.get('/api/questionbank', (req, res) => {
  const teacherId = req.query.teacherId;
  db.all(
    `SELECT * FROM BanqueQuestions WHERE enseignant_id = ?`,
    [teacherId || 1],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, questions: rows });
    }
  );
});

// Ajouter une question à la banque
app.post('/api/questionbank', (req, res) => {
  const { teacherId, enonce, typeReponse, points } = req.body;
  db.run(
    `INSERT INTO BanqueQuestions (enseignant_id, enonce, typeReponse, points) VALUES (?, ?, ?, ?)`,
    [teacherId || 1, enonce, typeReponse, points || 1],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Supprimer une question de la banque
app.delete('/api/questionbank/:id', (req, res) => {
  const questionId = req.params.id;
  db.run(
    `DELETE FROM BanqueQuestions WHERE id = ?`,
    [questionId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// ================= CORRECTIONS & RESULTATS =================

// Récupérer les copies d'une session
app.get('/api/sessions/:id/results', (req, res) => {
  const sessionId = req.params.id;
  db.all(
    `SELECT u.id as studentId, u.matricule, u.nom, u.prenom, u.email,
            c.id as copieId, c.contenuCode, c.fluxUML, c.estValidee, c.notesJSON, c.noteFinale, c.commentaire, c.horodatageDerniereModif
     FROM Copie c
     JOIN Utilisateur u ON c.etudiant_id = u.id
     WHERE c.session_id = ?`,
    [sessionId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, results: rows });
    }
  );
});

// Corriger une copie
app.post('/api/copies/:id/grade', (req, res) => {
  const copieId = req.params.id;
  const { notesJSON, noteFinale, commentaire } = req.body;
  db.run(
    `UPDATE Copie SET notesJSON = ?, noteFinale = ?, commentaire = ? WHERE id = ?`,
    [JSON.stringify(notesJSON), noteFinale, commentaire, copieId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// Soumettre définitivement la copie
app.post('/api/copies/submit', (req, res) => {
  const { copieId } = req.body;
  db.run(
    `UPDATE Copie SET estValidee = 1, horodatageDerniereModif = CURRENT_TIMESTAMP WHERE id = ?`,
    [copieId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true });
    }
  );
});

// ================= LAUNCH SERVER =================

app.listen(PORT, () => {
  console.log(`========================================================`);
  console.log(`🚀 SERVEUR CENTRAL SAFECODE-EXAM démarré sur le port ${PORT}`);
  console.log(`👉 API de synchronisation prête pour les étudiants et profs.`);
  console.log(`========================================================`);
});
