FROM node:22-slim

WORKDIR /app

# Copier les fichiers de dépendances et installer
COPY package*.json ./
RUN npm install

# Copier tout le code du frontend
COPY . .

EXPOSE 5173
# Vite avec --host pour être accessible depuis l'extérieur du conteneur
CMD ["npx", "vite", "--host", "0.0.0.0"]
