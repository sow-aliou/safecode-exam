import { createClient } from '@libsql/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbUrl = process.env.TURSO_DATABASE_URL || `file:${path.join(__dirname, 'server_database.db')}`;
const authToken = process.env.TURSO_AUTH_TOKEN;

const db = createClient({
  url: dbUrl,
  authToken: authToken,
});

async function initServerDb() {
  try {
    // 1. Table Utilisateur
    await db.execute(`
      CREATE TABLE IF NOT EXISTS Utilisateur (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        matricule TEXT UNIQUE,
        nom TEXT,
        prenom TEXT,
        email TEXT UNIQUE,
        motDePasse TEXT,
        typeUtilisateur TEXT
      )
    `);

    // 2. Table Examen
    await db.execute(`
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
    await db.execute(`
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
    await db.execute(`
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
        dernierPing DATETIME,
        FOREIGN KEY (etudiant_id) REFERENCES Utilisateur(id),
        FOREIGN KEY (session_id) REFERENCES SessionExamen(id),
        UNIQUE(etudiant_id, session_id)
      )
    `);

    try { await db.execute("ALTER TABLE Copie ADD COLUMN notesJSON TEXT DEFAULT '{}'"); } catch(e){}
    try { await db.execute("ALTER TABLE Copie ADD COLUMN noteFinale REAL DEFAULT 0"); } catch(e){}
    try { await db.execute("ALTER TABLE Copie ADD COLUMN commentaire TEXT DEFAULT ''"); } catch(e){}
    try { await db.execute("ALTER TABLE Copie ADD COLUMN dernierPing DATETIME"); } catch(e){}

    // 5. Table JournalLog
    await db.execute(`
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
    await db.execute(`
      CREATE TABLE IF NOT EXISTS BanqueQuestions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enseignant_id INTEGER,
        enonce TEXT,
        typeReponse TEXT,
        points INTEGER,
        testCases TEXT DEFAULT '[]'
      )
    `);
    
    try { await db.execute("ALTER TABLE BanqueQuestions ADD COLUMN testCases TEXT DEFAULT '[]'"); } catch(e){}

    console.log("Connecté à la base de données libSQL/Turso.");
  } catch (err) {
    console.error("Erreur d'initialisation libSQL:", err);
  }
}

// Lancer l'init
initServerDb();

const dbWrapper = {
  execute: async (sql) => await db.execute(sql),
  run: (sql, params, cb) => {
    if (typeof params === 'function') { cb = params; params = []; }
    db.execute({ sql, args: params || [] })
      .then(res => {
        const lastID = res.lastInsertRowid ? Number(res.lastInsertRowid) : undefined;
        if (cb) cb.call({ lastID }, null);
      })
      .catch(err => {
        if (cb) cb(err);
      });
  },
  get: (sql, params, cb) => {
    if (typeof params === 'function') { cb = params; params = []; }
    db.execute({ sql, args: params || [] })
      .then(res => {
        if (cb) cb(null, res.rows.length > 0 ? res.rows[0] : undefined);
      })
      .catch(err => {
        if (cb) cb(err);
      });
  },
  all: (sql, params, cb) => {
    if (typeof params === 'function') { cb = params; params = []; }
    db.execute({ sql, args: params || [] })
      .then(res => {
        if (cb) cb(null, res.rows);
      })
      .catch(err => {
        if (cb) cb(err);
      });
  },
  serialize: (cb) => {
    if (cb) cb();
  }
};

export default dbWrapper;
