FROM node:22-slim

WORKDIR /server

# Copier les fichiers de dépendances et installer
COPY package*.json ./
RUN npm install --omit=dev

# Copier tout le code du serveur
COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
