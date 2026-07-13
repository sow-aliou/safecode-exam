# Étape 1 : Construction du Frontend (React/Vite)
FROM node:18-alpine AS builder
WORKDIR /app

# Copier les fichiers de dépendances du frontend
COPY package*.json ./
# Installer les dépendances du frontend
RUN npm install

# Copier le reste du code frontend et construire
COPY . .
RUN npm run build

# Étape 2 : Préparation du Backend et de l'image finale
FROM node:18-alpine
WORKDIR /app

# Créer le répertoire pour la base de données (Volume)
RUN mkdir -p /app/data

# Copier et installer les dépendances du backend
COPY server/package*.json ./server/
RUN cd server && npm install

# Copier le code du backend
COPY server/ ./server/

# Copier le build du frontend (dossier dist) généré à l'étape 1
COPY --from=builder /app/dist ./dist

# Définir le chemin de la base de données vers le volume monté
ENV DB_PATH=/app/data/safecode.db
ENV PORT=3000

# Exposer le port du serveur
EXPOSE 3000

# Démarrer le serveur
CMD ["node", "server/server.js"]
