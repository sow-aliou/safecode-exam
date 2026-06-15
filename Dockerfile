# Utilisation d'une image Node.js officielle (la version 20 est la LTS actuelle)
FROM node:20

# Installer les dépendances nécessaires pour Electron (X11, GTK, etc.)
RUN apt-get update && apt-get install -y \
    libx11-xcb1 \
    libxcb-dri3-0 \
    libxtst6 \
    libnss3 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libxss1 \
    libasound2 \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier le reste du projet
COPY . .

# Exposer le port de Vite
EXPOSE 5173

# Commande par défaut pour lancer l'environnement de développement
CMD ["npm", "run", "dev:app"]
