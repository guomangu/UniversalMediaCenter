FROM docker.io/node:20-alpine

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances (y compris Prisma si ajouté)
RUN npm install

# Copier le reste du code
COPY . .

# Exposer le port de l'API Hono
EXPOSE 3000

# En développement, on lance le serveur de dev
CMD ["npm", "run", "dev"]
