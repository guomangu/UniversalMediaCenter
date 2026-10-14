# Dossier Base de Données

Ce dossier contient le fichier de base de données SQLite (ex: `database.sqlite`) généré par Prisma.
Il est monté en volume dans le conteneur backend via `compose.yaml`.

L'approche "File-Based" permet de dupliquer ou de lire ce fichier sans serveur complexe.
