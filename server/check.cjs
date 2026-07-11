const sqlite3 = require('sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'server_database.db');
const db = new sqlite3.Database(dbPath);
db.all("SELECT matricule, motDePasse, prenom, nom FROM Utilisateur WHERE typeUtilisateur='Etudiant' LIMIT 5", (err, rows) => {
  console.log(JSON.stringify(rows, null, 2));
});
