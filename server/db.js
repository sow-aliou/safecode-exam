import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'server_database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erreur de connexion SQLite serveur:', err.message);
  } else {
    console.log('Connecté à la base de données SQLite du serveur central.');
    initServerDb();
  }
});

function initServerDb() {
  db.serialize(() => {
    // 1. Table Utilisateur (Enseignant et Etudiant)
    db.run(`
      CREATE TABLE IF NOT EXISTS Utilisateur (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        matricule TEXT UNIQUE,
        nom TEXT,
        prenom TEXT,
        email TEXT UNIQUE,
        motDePasse TEXT,
        typeUtilisateur TEXT -- 'Etudiant' ou 'Enseignant'
      )
    `);

    // 2. Table Examen
    db.run(`
      CREATE TABLE IF NOT EXISTS Examen (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enseignant_id INTEGER,
        titre TEXT,
        instructions TEXT,
        langageCible TEXT,
        dureeMinutes INTEGER,
        sujetPdfBase64 TEXT,
        enonceTexte TEXT,
        FOREIGN KEY (enseignant_id) REFERENCES Utilisateur(id)
      )
    `);

    // 3. Table SessionExamen
    db.run(`
      CREATE TABLE IF NOT EXISTS SessionExamen (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codeAccesSecret TEXT UNIQUE,
        dateHeureDebut DATETIME,
        estCloturee BOOLEAN DEFAULT 0,
        examen_id INTEGER,
        FOREIGN KEY (examen_id) REFERENCES Examen(id)
      )
    `);

    // 4. Table Copie
    db.run(`
      CREATE TABLE IF NOT EXISTS Copie (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        etudiant_id INTEGER,
        session_id INTEGER,
        contenuCode TEXT,
        fluxUML TEXT,
        estValidee BOOLEAN DEFAULT 0,
        horodatageDerniereModif DATETIME DEFAULT CURRENT_TIMESTAMP,
        notesJSON TEXT DEFAULT '{}',
        noteFinale REAL DEFAULT 0,
        commentaire TEXT DEFAULT '',
        FOREIGN KEY (etudiant_id) REFERENCES Utilisateur(id),
        FOREIGN KEY (session_id) REFERENCES SessionExamen(id),
        UNIQUE(etudiant_id, session_id)
      )
    `, () => {
      // Pour les bases de données existantes, ajouter les colonnes si elles manquent
      db.run("ALTER TABLE Copie ADD COLUMN notesJSON TEXT DEFAULT '{}'", (err) => {});
      db.run("ALTER TABLE Copie ADD COLUMN noteFinale REAL DEFAULT 0", (err) => {});
      db.run("ALTER TABLE Copie ADD COLUMN commentaire TEXT DEFAULT ''", (err) => {});
    });

    // 5. Table JournalLog
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
    `);

    // 6. Table BanqueQuestions
    db.run(`
      CREATE TABLE IF NOT EXISTS BanqueQuestions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enseignant_id INTEGER,
        enonce TEXT,
        typeReponse TEXT,
        points INTEGER
      )
    `);
  });
}

export default db;
