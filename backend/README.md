# Backend (Hono + TypeScript)

L'API backend est développée avec [Hono](https://hono.dev/) en TypeScript.
La base de données est gérée via Prisma ORM avec SQLite.

## Lancer l'API

L'API est orchestrée via Podman à la racine du projet :
```bash
cd ..
podman-compose up -d backend
```

Elle sera disponible sur `http://localhost:3000`.
