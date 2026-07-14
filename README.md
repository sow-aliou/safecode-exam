# SafeCode-Exam 🎓💻

SafeCode-Exam est une plateforme web sécurisée de passage d'examens de programmation en temps réel. Elle permet aux enseignants d'organiser des évaluations de code de manière fluide et sécurisée.

## 🌟 Fonctionnalités Principales

*   **👨‍🏫 Espace Enseignant (Tableau de bord) :**
    *   Création et gestion des sessions d'examens.
    *   Importation en masse d'étudiants via des fichiers Excel/CSV.
    *   Génération automatique et sécurisée de codes d'accès uniques pour chaque étudiant.
*   **🧑‍🎓 Espace Étudiant :**
    *   Interface de code avec coloration syntaxique et environnement immersif.
    *   Sauvegarde automatique du code en temps réel pendant l'épreuve.
*   **🛠️ Architecture Technique :**
    *   **Frontend :** React.js + Vite.
    *   **Backend :** Node.js + Express.js.
    *   **Base de données :** SQLite / Turso (libSQL) pour le déploiement cloud.
    *   **Déploiement :** Conçu pour être hébergé sur Render.

## 🚀 Installation Locale

### 1. Prérequis
*   [Node.js](https://nodejs.org/) (version 18 ou supérieure)
*   Un compte [Turso](https://turso.tech/) (optionnel si vous utilisez SQLite en local)

### 2. Cloner le projet et installer les dépendances
```bash
git clone https://github.com/sow-aliou/safecode-exam.git
cd safecode-exam
npm install
cd server
npm install
```

### 3. Variables d'environnement
Créez un fichier `.env` à la racine du projet et configurez vos variables (voir `.env.example` si disponible) :
```env
JWT_SECRET=votre_cle_secrete_hyper_longue
# Configuration Turso (Laissez vide pour utiliser SQLite en local)
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=votre_token
# Configuration Email (Optionnel - Pour l'envoi des codes)
SMTP_USER=votre_email@gmail.com
SMTP_PASS=votre_mot_de_passe_d_application
```

### 4. Démarrer l'application
Le projet nécessite de lancer le frontend et le backend séparément en mode développement.

**Dans un terminal (Backend) :**
```bash
node server/server.js
```
*(Le serveur démarrera sur http://localhost:3000)*

**Dans un second terminal (Frontend) :**
```bash
npm run dev
```
*(L'interface web démarrera sur http://localhost:5174)*

## 🌐 Déploiement (Render)

L'application est conçue pour être déployée facilement sur **Render** en tant que *Web Service* :
1.  Connectez votre dépôt GitHub à Render.
2.  **Build Command:** `npm install && npm run build && cd server && npm install`
3.  **Start Command:** `node server/server.js`
4.  N'oubliez pas d'ajouter vos variables d'environnement (TURSO, JWT, SMTP) dans l'onglet *Environment* de Render.

*(Note : Sur l'offre gratuite de Render, le port SMTP 587 est bloqué, l'envoi d'emails automatique nécessitera une configuration alternative ou la distribution manuelle des codes via le tableau de bord).*
