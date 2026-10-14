# Stack Universelle — Documentation Technique Complète (v3.0)

## 1. Vue d'Ensemble de l'Architecture

The Universal Media Stack (UMS) repose sur une architecture distribuée et conteneurisée :
- **Backend API :** Framework ultra-léger [Hono](https://hono.dev) sous Node.js 20+, piloté par TypeScript.
- **Base de Données :** PostgreSQL 16 enrichi de PostGIS (géospatial), `pg_trgm` (recherche floue instantanée < 10ms) et `unaccent`.
- **ORM :** [Drizzle ORM](https://orm.drizzle.team) avec schémas typés stricts et migrations SQL directes.
- **Frontend :** Expo / React Native Web, supportant mobile, desktop et télévision (Android TV / Tizen / WebOS / navigateurs).
- **Passerelle Réseau :** Caddy 2 Reverse Proxy avec négociation automatique HTTP Range pour le streaming et en-têtes CORS.

---

## 2. Modules Backend Découpés (< 100 lignes)

### A. Watcher & Ingestion (`backend/src/watcher/`)
- `seasonEpisodeHelper.ts` : Extraction propre des saisons et épisodes (`S01E05`, `1x05`, etc.), génération de tags saillants et calcul du score de tri invariant `(season * 10000) + episode`.
- `titleCleaner.ts` : Nettoyage regex des titres, suppression des mentions de release.
- `nfoParser.ts` : Parsing XML `fast-xml-parser` tolérant.
- `mediaIngester.ts` : Insertion et mise à jour idempotente des `media_nodes`.
- `tagExtractor.ts` : Extraction et liaison dynamique EAV.
- `bootScanner.ts` : Crawler initial asynchrone découvrant les `.nfo` au boot.
- `index.ts` : Surveillance inotify temps réel multi-dossiers (`MEDIA_CHAOS_ROOT`).

### B. Routes API Utilisateur & Social (`backend/src/routes/`)
- `userProfileRoutes.ts` : Consultation et mise à jour du profil (`GET /api/user/profile`, `PUT /api/user/profile`).
- `userStatsRoutes.ts` : Statistiques en direct du catalogue et de l'utilisateur (`GET /api/user/stats`).
- `userWatchRoutes.ts` : Reprise de lecture et historique (`GET /api/user/continue-watching`, `GET /api/user/history`).
- `userFavoritesRoutes.ts` : Gestion des favoris (`GET /api/user/favorites`, `POST /api/user/favorites/:nodeId`, `DELETE`, `check`).
- `userForumsRoutes.ts` : Liste des salons auxquels l'utilisateur a participé (`GET /api/user/forums`).
- `friendActionRoutes.ts` : Liste d'amis, envoi de demandes, acceptation et rejet (`GET /api/friends`, `POST /request`, `/accept`, `/reject`).
- `friendSearchRoutes.ts` : Recherche instantanée de membres (`GET /api/friends/search?q=...`).
- `repostMediaRoutes.ts` : Repost de média avec note 1-5 étoiles et commentaire (`POST /api/reposts/media/:id`, `GET /media/:id`).
- `repostFeedRoutes.ts` : Fil social des reposts d'amis (`GET /api/reposts/feed`, `GET /user`, `DELETE /:id`).
- `mediaNext.ts` : Enchaînement automatique Netflix pour séries, animes et sagas (`GET /api/media/:id/next`).
- `forumRoutes.ts` : Forums de discussion WhatsApp avec filtrage sécurisé des salons privés réservés aux amis (`private-user-[userId]`).

---

## 3. Schéma Relationnel & Tables PostgreSQL

- `users` : Comptes utilisateurs avec `email`, `displayName`, `passwordHash` (scrypt), `avatarUrl`, `bio`, rôles (`isAdmin`, `canDownload`, `canWatchIptv`, `maxCsaAgeLimit`).
- `media_nodes` : Films, séries, saisons, épisodes, collections et chaînes IPTV avec métadonnées, chemins physiques et vecteur trigramme.
- `watch_progress` : Progression de visionnage (`userId`, `nodeId`, `positionSeconds`, `durationSeconds`, `isCompleted`).
- `user_favorites` : Favoris enregistrés avec index unique `(user_id, node_id)`.
- `user_friends` : Réseau d'amitié avec statut `PENDING` ou `ACCEPTED`.
- `media_reposts` : Publications avec notation 1-5 étoiles et avis optionnel.
- `forum_messages` : Messages communautaires (texte, images, vocaux, citations) indexés sur `topic_slug`.

---

## 4. Frontend & Expérience Utilisateur (Charte UX)

- `app/user.tsx` : Espace personnel tout-en-un avec onglets Reprendre, Favoris, Amis, Mes Salons et Fil d'actualité.
- `components/VideoPlayerView.tsx` & `app/player/[id].tsx` : Lecteur vidéo avec overlay de fin d'épisode et compte à rebours 8s pour enchaîner sans télécommande.
- `components/MediaCard.tsx` & `MediaChildrenRow.tsx` : Cartes et listes affichant le badge de saison/épisode saillant et la barre de progression.
- `components/MediaRepostModal.tsx` : Modal progressive pour noter et reposter un média en 2 champs.
- `app/+not-found.tsx` : Interception 404 et redirection automatique vers l'accueil.
