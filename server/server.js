import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import db from './db.js';
import { autoGradeCopie } from './autograder.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'safecode_super_secret_key_2026';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Servir les fichiers statiques du Frontend (React/Vite)
app.use(express.static(path.join(__dirname, '../dist')));

let transporter;
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_PORT == 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  console.log("Nodemailer configuré avec le serveur SMTP personnalisé.");
} else {
  // Mode sans email pour Render (simulation instantanée sans bloquer)
  transporter = {
    sendMail: async (options) => {
      console.log(`[SIMULATION EMAIL] Email "envoyé" (simulé) à: ${options.to}`);
      return { messageId: 'simulated-' + Date.now() };
    }
  };
  console.log("Nodemailer: SMTP non configuré. Les emails seront simulés dans la console (ultra-rapide).");
}

// ================= JWT MIDDLEWARE =================

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Accès refusé. Jeton manquant." });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Jeton invalide ou expiré." });
    }
    req.user = user;
    next();
  });
}

// ================= TEACHER AUTH =================

app.post('/api/teacher/register', async (req, res) => {
  const { nom, prenom, email, motDePasse } = req.body;
  if (!email || !motDePasse) {
    return res.status(400).json({ error: "Email et mot de passe requis." });
  }

  try {
    const hashedPassword = await bcrypt.hash(motDePasse, 10);
    db.run(
      `INSERT INTO Utilisateur (nom, prenom, email, motDePasse, typeUtilisateur) VALUES (?, ?, ?, ?, 'Enseignant')`,
      [nom, prenom, email, hashedPassword],
      function(err) {
        if (err) {
          return res.status(400).json({ error: "Cet email est déjà enregistré." });
        }
        res.json({ success: true, teacherId: this.lastID });
      }
    );
  } catch (error) {
    res.status(500).json({ error: "Erreur lors du hachage du mot de passe." });
  }
});

app.post('/api/teacher/login', (req, res) => {
  const { email, motDePasse } = req.body;
  db.get(
    `SELECT * FROM Utilisateur WHERE email = ? AND typeUtilisateur = 'Enseignant'`,
    [email],
    async (err, row) => {
      if (err || !row) {
        return res.status(400).json({ error: "Identifiants incorrects." });
      }
      
      const match = await bcrypt.compare(motDePasse, row.motDePasse);
      if (!match) {
        // Fallback for plaintext passwords (legacy) during transition
        if (motDePasse === row.motDePasse) {
          console.warn(`Plaintext password matched for ${email}. You should re-register or update your password.`);
        } else {
          return res.status(400).json({ error: "Identifiants incorrects." });
        }
      }

      const token = jwt.sign(
        { id: row.id, role: 'Enseignant' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({ 
        success: true, 
        token,
        teacher: { id: row.id, nom: row.nom, prenom: row.prenom, email: row.email } 
      });
    }
  );
});

// ================= SESSIONS & EXAMS =================

// Récupérer toutes les sessions d'un enseignant
app.get('/api/sessions', authenticateToken, (req, res) => {
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

// Récupérer le statut en direct des étudiants d'une session
app.get('/api/sessions/:id/live', authenticateToken, (req, res) => {
  const sessionId = req.params.id;
  
  db.all(
    `SELECT c.id as copieId, u.id as studentId, u.nom, u.prenom, u.matricule, c.estValidee, c.dernierPing
     FROM Copie c
     JOIN Utilisateur u ON c.etudiant_id = u.id
     WHERE c.session_id = ?`,
    [sessionId],
    (err, students) => {
      if (err) return res.status(500).json({ error: err.message });
      
      db.all(
        `SELECT id, etudiant_id, horodatage, typeEvenement, description, criticite 
         FROM JournalLog 
         WHERE session_id = ? ORDER BY horodatage DESC`,
        [sessionId],
        (err2, logs) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ success: true, students, logs });
        }
      );
    }
  );
});

// Créer une session et son épreuve associée
app.post('/api/sessions', authenticateToken, (req, res) => {
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
app.get('/api/sessions/:id/exam', authenticateToken, (req, res) => {
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

// Mettre à jour l'épreuve complète (questions, PDF, titre, durée, date...)
app.post('/api/sessions/:id/exam', authenticateToken, (req, res) => {
  const sessionId = req.params.id;
  const { title, duree, instructions, langageCible, sujetPdfBase64, questions, dateHeureDebut } = req.body;

  db.serialize(() => {
    db.run(
      `UPDATE Examen SET titre = ?, dureeMinutes = ?, instructions = ?, langageCible = ?, sujetPdfBase64 = ?, enonceTexte = ?
       WHERE id = (SELECT examen_id FROM SessionExamen WHERE id = ?)`,
      [title, duree || 120, instructions, langageCible || 'Java', sujetPdfBase64 || null, JSON.stringify(questions || []), sessionId],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        if (dateHeureDebut) {
          db.run(
            `UPDATE SessionExamen SET dateHeureDebut = ? WHERE id = ?`,
            [dateHeureDebut, sessionId],
            (err2) => {
              if (err2) return res.status(500).json({ error: err2.message });
              res.json({ success: true });
            }
          );
        } else {
          res.json({ success: true });
        }
      }
    );
  });
});

// Ajouter du temps à une session en cours
app.post('/api/sessions/:id/add-time', authenticateToken, (req, res) => {
  const sessionId = req.params.id;
  const { additionalMinutes } = req.body;

  if (!additionalMinutes || isNaN(additionalMinutes)) {
    return res.status(400).json({ error: 'additionalMinutes est requis et doit être un nombre.' });
  }

  db.serialize(() => {
    // Il faut d'abord récupérer l'examen lié à la session
    db.get(`SELECT examen_id FROM SessionExamen WHERE id = ?`, [sessionId], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Session introuvable.' });

      db.run(
        `UPDATE Examen SET dureeMinutes = dureeMinutes + ? WHERE id = ?`,
        [Number(additionalMinutes), row.examen_id],
        function(err2) {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ success: true, added: additionalMinutes });
        }
      );
    });
  });
});

// Uploader le PDF sujet (legacy)
app.post('/api/sessions/:id/pdf', authenticateToken, (req, res) => {
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
app.post('/api/sessions/:id/students', authenticateToken, async (req, res) => {
  const sessionId = req.params.id;
  const teacherId = req.user.id;
  const { students } = req.body;

  if (!students || !Array.isArray(students)) {
    return res.status(400).json({ error: "Liste d'étudiants invalide." });
  }

  try {
    const contextInfoRes = await db.execute({
      sql: `SELECT u.nom as profNom, u.prenom as profPrenom, e.titre as examenTitre, s.codeAccesSecret, s.dateHeureDebut
             FROM Utilisateur u, SessionExamen s 
             JOIN Examen e ON s.examen_id = e.id 
             WHERE u.id = ? AND s.id = ?`,
      args: [teacherId, sessionId]
    });
    
    const contextInfo = contextInfoRes.rows.length > 0 ? contextInfoRes.rows[0] : null;
    const profNom = contextInfo ? contextInfo.profNom : 'votre enseignant';
    const profPrenom = contextInfo ? contextInfo.profPrenom : '';
    const examenTitre = contextInfo ? contextInfo.examenTitre : 'Épreuve Sécurisée';
    const sessionCode = contextInfo ? contextInfo.codeAccesSecret : sessionId;
    
    let dateExamenFormatee = 'Date non spécifiée';
    if (contextInfo && contextInfo.dateHeureDebut) {
      const d = new Date(contextInfo.dateHeureDebut);
      dateExamenFormatee = d.toLocaleString('fr-FR', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
      });
    }

    let completed = 0;
    let errors = [];

    for (const student of students) {
      try {
        const hashedPassword = await bcrypt.hash(student.codeSecret, 10);
        
        await db.execute({
          sql: `INSERT INTO Utilisateur (matricule, nom, prenom, email, motDePasse, typeUtilisateur) 
                VALUES (?, ?, ?, ?, ?, 'Etudiant')
                ON CONFLICT(matricule) DO UPDATE SET nom=excluded.nom, prenom=excluded.prenom, email=excluded.email, motDePasse=excluded.motDePasse`,
          args: [student.matricule, student.nom, student.prenom, student.email, hashedPassword]
        });

        const userRes = await db.execute({
          sql: `SELECT id FROM Utilisateur WHERE matricule = ?`,
          args: [student.matricule]
        });
        
        if (userRes.rows.length === 0) {
          throw new Error("Utilisateur non trouvé après insertion");
        }
        
        const studentId = userRes.rows[0].id;

        await db.execute({
          sql: `INSERT INTO Copie (etudiant_id, session_id, contenuCode, fluxUML) 
                VALUES (?, ?, '', '')
                ON CONFLICT(etudiant_id, session_id) DO NOTHING`,
          args: [studentId, sessionId]
        });

        // Envoi email optionnel
        if (typeof transporter !== 'undefined' && transporter) {
          try {
            const emailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #f9fafb;">
                <div style="text-align: center; margin-bottom: 20px;">
                  <h2 style="color: #10b981; margin: 0;">SafeCode Exam</h2>
                </div>
                <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                  <p style="font-size: 16px; color: #374151;">Bonjour <strong>${student.prenom}</strong>,</p>
                  <p style="font-size: 16px; color: #374151; line-height: 1.5;">
                    Le professeur <strong>${profPrenom} ${profNom}</strong> vous a convié(e) à participer à l'examen <strong>"${examenTitre}"</strong> sur la plateforme SafeCode.
                  </p>
                  
                  <div style="background-color: #eef2ff; padding: 12px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #6366f1;">
                    <p style="margin: 0; font-size: 15px; color: #4338ca;"><strong>📅 Date de l'épreuve :</strong> ${dateExamenFormatee}</p>
                  </div>

                  <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10b981;">
                    <p style="margin: 0 0 10px 0; font-size: 15px; color: #4b5563;">Voici vos accès personnels et confidentiels pour vous connecter à l'épreuve :</p>
                    <ul style="list-style-type: none; padding: 0; margin: 0;">
                      <li style="margin-bottom: 8px;"><span style="color: #6b7280;">Code de session :</span> <strong style="font-size: 18px; color: #111827; letter-spacing: 1px;">${sessionCode}</strong></li>
                      <li style="margin-bottom: 8px;"><span style="color: #6b7280;">Matricule :</span> <strong style="font-size: 16px; color: #111827;">${student.matricule}</strong></li>
                      <li><span style="color: #6b7280;">Code Secret :</span> <strong style="font-size: 18px; color: #10b981; letter-spacing: 1px;">${student.codeSecret}</strong></li>
                    </ul>
                  </div>
                  <p style="font-size: 15px; color: #4b5563; line-height: 1.5;">
                    Rendez-vous sur la plateforme à l'heure prévue pour l'épreuve.<br>
                    Veuillez ne pas partager ces identifiants, ils sont uniques et liés à votre copie.
                  </p>
                  <p style="font-size: 16px; color: #374151; font-weight: bold; margin-top: 30px;">Bon courage et excellente journée !</p>
                </div>
                <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #9ca3af;">
                  <p>Cet email a été envoyé automatiquement par la plateforme SafeCode-Exam. Merci de ne pas y répondre.</p>
                </div>
              </div>
            `;
            const mailOptions = {
              from: '"Plateforme SAFECODE-EXAM" <noreply@safecode-exam.com>',
              to: student.email,
              subject: `🚨 Vos Accès pour l'examen : ${examenTitre}`,
              html: emailHtml
            };
            
            // Fire and forget pour ne pas ralentir le serveur
            transporter.sendMail(mailOptions)
              .then(() => console.log(`[EMAIL ENVOYÉ] à ${student.email}`))
              .catch(mailErr => console.error(`Erreur d'envoi d'email à ${student.email}:`, mailErr.message));
            
          } catch (mailErr) {
            console.error(`Erreur d'envoi d'email à ${student.email}:`, mailErr.message);
          }
        }
        completed++;
      } catch (err) {
        console.error(err);
        errors.push(`Erreur pour ${student.matricule}: ${err.message}`);
      }
    }

    res.json({ success: true, count: completed, errors });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Récupérer les étudiants d'une session
app.get('/api/sessions/:id/students', authenticateToken, (req, res) => {
  const sessionId = req.params.id;
  db.all(
    `SELECT u.id, u.matricule, u.nom, u.prenom, u.email, '***' as codeSecret, c.estValidee
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

// ================= STUDENT LIVE TRACKING & AUTH =================

app.post('/api/student/ping', authenticateToken, (req, res) => {
  const { copieId, etudiantId, sessionId, alerts } = req.body;
  if (!copieId) return res.status(400).json({ error: "copieId requis" });

  db.serialize(() => {
    // Mettre à jour le dernier ping
    db.run(`UPDATE Copie SET dernierPing = CURRENT_TIMESTAMP WHERE id = ?`, [copieId]);

    // Enregistrer les alertes s'il y en a
    if (alerts && alerts.length > 0) {
      const stmt = db.prepare(`INSERT INTO JournalLog (session_id, etudiant_id, typeEvenement, description, criticite) VALUES (?, ?, ?, ?, ?)`);
      alerts.forEach(alert => {
        stmt.run([sessionId, etudiantId, alert.type, alert.description, alert.criticite || 'Avertissement']);
      });
      stmt.finalize();
    }
  });

  res.json({ success: true });
});

app.post('/api/student/login', (req, res) => {
  const { matricule, sessionCode, password } = req.body;

  db.get(
    `SELECT u.id as studentId, u.matricule, u.nom, u.prenom, u.motDePasse, s.id as sessionId, c.id as copieId, c.estValidee,
            e.titre, e.dureeMinutes, e.instructions, e.langageCible, e.sujetPdfBase64, e.enonceTexte, s.dateHeureDebut
     FROM Utilisateur u
     JOIN Copie c ON c.etudiant_id = u.id
     JOIN SessionExamen s ON c.session_id = s.id
     JOIN Examen e ON s.examen_id = e.id
     WHERE u.matricule = ? AND s.codeAccesSecret = ?`,
    [matricule, sessionCode],
    async (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        return res.status(400).json({ error: "Identifiants invalides ou session introuvable." });
      }

      const match = await bcrypt.compare(password, row.motDePasse);
      if (!match) {
        // Fallback for plaintext passwords during transition
        if (password !== row.motDePasse) {
          return res.status(400).json({ error: "Identifiants invalides ou session introuvable." });
        }
      }

      if (row.estValidee) {
        return res.status(403).json({ error: "Vous avez déjà soumis votre copie pour cette épreuve." });
      }
      
      if (row.dateHeureDebut) {
        const start = new Date(row.dateHeureDebut);
        const end = new Date(start.getTime() + (row.dureeMinutes || 120) * 60000);
        const now = new Date();
        if (now < start) {
          const formattedStart = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          return res.status(403).json({ error: `L'épreuve n'a pas encore commencé. Ouverture prévue à ${formattedStart}.` });
        }
        if (now > end) {
          return res.status(403).json({ error: "L'épreuve est déjà terminée et l'accès est fermé." });
        }
      }

      const token = jwt.sign(
        { id: row.studentId, role: 'Etudiant', copieId: row.copieId, sessionId: row.sessionId },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      // Remove motDePasse before sending user object
      delete row.motDePasse;

      // Anti-triche: Masquer les bonnes réponses QCM à l'étudiant
      if (row.enonceTexte) {
        try {
          const parsedQuestions = JSON.parse(row.enonceTexte);
          if (Array.isArray(parsedQuestions)) {
            parsedQuestions.forEach(q => {
              if (q.typeReponse === 'qcm' && Array.isArray(q.options)) {
                q.options.forEach(opt => delete opt.isCorrect);
              }
            });
            row.enonceTexte = JSON.stringify(parsedQuestions);
          }
        } catch(e) {}
      }

      res.json({ success: true, token, user: row });
    }
  );
});

// ================= COPIES AUTO-SAVE & SUBMIT =================

// Synchronisation des réponses
app.post('/api/copies/sync', authenticateToken, (req, res) => {
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

// ================= CORRECTIONS & RESULTATS =================

// Récupérer les copies d'une session
app.get('/api/sessions/:id/results', authenticateToken, (req, res) => {
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
app.post('/api/copies/:id/grade', authenticateToken, (req, res) => {
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

// Auto-correction d'une copie (exécute le code et compare aux cas de tests)
app.post('/api/copies/:id/auto-grade', authenticateToken, (req, res) => {
  const copieId = req.params.id;

  // 1. Récupérer la copie et l'épreuve associée
  db.get(
    `SELECT c.*, e.enonceTexte, e.langageCible
     FROM Copie c
     JOIN SessionExamen s ON c.session_id = s.id
     JOIN Examen e ON s.examen_id = e.id
     WHERE c.id = ?`,
    [copieId],
    async (err, copie) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!copie) return res.status(404).json({ error: 'Copie introuvable.' });

      let examQs = [];
      try { examQs = JSON.parse(copie.enonceTexte || '[]'); } catch (_) {}

      const lang = (copie.langageCible || 'python').toLowerCase().includes('java') ? 'java' : 'python';

      try {
        const result = await autoGradeCopie(copie, examQs, lang);
        res.json({ success: true, ...result });
      } catch (runErr) {
        console.error('[AutoGrader] Erreur:', runErr);
        res.status(500).json({ error: runErr.message });
      }
    }
  );
});

// Soumettre définitivement la copie
app.post('/api/copies/submit', authenticateToken, (req, res) => {
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

// ================= REACT CATCH-ALL ROUTE =================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// ================= LAUNCH SERVER =================

app.listen(PORT, () => {
  console.log(`========================================================`);
  console.log(`🚀 SERVEUR CENTRAL SAFECODE-EXAM démarré sur le port ${PORT}`);
  console.log(`👉 API de synchronisation prête pour les étudiants et profs.`);
  console.log(`========================================================`);
});
