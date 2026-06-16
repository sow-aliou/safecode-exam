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
        FOREIGN KEY (etudiant_id) REFERENCES Utilisateur(id),
        FOREIGN KEY (session_id) REFERENCES SessionExamen(id),
        UNIQUE(etudiant_id, session_id)
      )
    `);

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
  });
}

export default db;
