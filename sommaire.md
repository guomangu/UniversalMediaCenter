# 📑 Sommaire Cartographique — The Universal Media Stack (v3.0)

Ce document répertorie l'intégralité de l'arborescence, des modules, des scripts et des fichiers sources de **The Universal Media Stack**. Il permet aux développeurs et agents IA de s'orienter instantanément dans le codebase.

---

## 🏛️ 1. Vue d'Ensemble de l'Architecture

The Universal Media Stack est conçu comme un **dossier autonome et portable** fonctionnant sous **Bazzite & Fedora** :
- **Backend :** API Hono (TypeScript) ultra-légère, Watcher NFO temps réel in-place, Parser IPTV M3U/EPG, Registry de Cast multi-protocoles.
- **Base de Données :** PostgreSQL 16 + PostGIS + `pg_trgm` + Drizzle ORM (modèle polymorphique EAV & Server-Driven UI).
- **Frontend :** Expo / React Native / Web universel et responsive (Glassmorphisme doux, TDAH-friendly, zéro angle aigu).
- **Gateway & Reverse Proxy :** Caddy 2 pour le streaming direct et l'invalidation de cache.

---

## 📁 2. Racine & Configuration Système

| Fichier / Dossier | Rôle & Description |
| :--- | :--- |
| [`start.sh`](file:///var/home/tele/Documents/theuniversalmediastack/start.sh) | Script de démarrage universel (détection Bazzite/Fedora, Podman/Docker, socket utilisateur, démarrage auto). |
| [`compose.yaml`](file:///var/home/tele/Documents/theuniversalmediastack/compose.yaml) | Orchestration des conteneurs (`ums_postgres`, `ums_api`, `ums_gateway`) avec bind mounts in-place (`:ro,z`). |
| [`.env`](file:///var/home/tele/Documents/theuniversalmediastack/.env) | Variables d'environnement globales (`MEDIA_CHAOS_ROOT`, ports, identifiants base de données). |
| [`config/Caddyfile`](file:///var/home/tele/Documents/theuniversalmediastack/config/Caddyfile) | Configuration Reverse Proxy Caddy routant l'API (`/api/*`), les artworks (`/artworks/*`) et l'interface Web (`/*`). |

---

## ⚙️ 3. Backend (`backend/src/`)

### 🚀 Point d'Entrée & Serveur HTTP
- [`backend/src/index.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/index.ts) : Initialisation du serveur Hono, exécution des migrations, amorçage du seeder Kyoo, lancement du watcher et du crawler de boot.

### 🗄️ Base de Données (`backend/src/db/`)
- [`backend/src/db/connection.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/db/connection.ts) : Client Postgres.js et instance Drizzle ORM avec pool de connexions.
- [`backend/src/db/runMigrations.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/db/runMigrations.ts) : Orchestrateur de migrations primaires et secondaires.
- [`backend/src/db/migrate.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/db/migrate.ts) : Extensions PostGIS/trigrammes et tables fondamentales (`media_nodes`, `eav_attributes`, `eav_values`, `node_eav_links`).
- [`backend/src/db/migrateSecondary.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/db/migrateSecondary.ts) : Tables secondaires (`ui_rails`, `users`, `watch_progress`, `iptv_sources`, `epg_programs`, index GIN).

#### 🧬 Schémas Drizzle Modulaires (`backend/src/db/schema/`)
- [`backend/src/db/schema/index.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/db/schema/index.ts) : Export agrégé de l'ensemble des schémas de données.
- [`backend/src/db/schema/enums.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/db/schema/enums.ts) : Énumérations Drizzle (`nodeTypeEnum`, `nodeStateEnum`, `tagZoneEnum`, `railTypeEnum`).
- [`backend/src/db/schema/spatial.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/db/schema/spatial.ts) : Type spatial PostGIS natif `GEOMETRY(Point, 4326)`.
- [`backend/src/db/schema/nodes.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/db/schema/nodes.ts) : Table `media_nodes` (films, séries, épisodes, chapitres JSON, search vector).
- [`backend/src/db/schema/eav.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/db/schema/eav.ts) : Modèle polymorphique EAV (`eav_attributes`, `eav_values`, `node_eav_links`).
- [`backend/src/db/schema/rails.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/db/schema/rails.ts) : Table `ui_rails` pour le Server-Driven UI.
- [`backend/src/db/schema/users.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/db/schema/users.ts) : Profils utilisateurs, contrôle parental par tags et `watch_progress`.
- [`backend/src/db/schema/iptv.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/db/schema/iptv.ts) : Tables `iptv_sources` et `epg_programs`.

### 🎬 Ingestion In-Place & Watcher .NFO (`backend/src/watcher/`)
- [`backend/src/watcher/bootScanner.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/bootScanner.ts) : Crawler récursif au démarrage parcourant `MEDIA_CHAOS_ROOT` pour ingérer instantanément tous les fichiers `.nfo` préexistants.
- [`backend/src/watcher/index.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/index.ts) : Watcher temps réel Chokidar sur multi-dossiers et fonction `processNfoFile()`.
- [`backend/src/watcher/mediaIngester.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/mediaIngester.ts) : Ingestion zéro-perte dans `media_nodes` et conversion automatique des métadonnées XML en tags EAV.
- [`backend/src/watcher/mediaFileDetector.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/mediaFileDetector.ts) : Détection in-place des vidéos adjacentes (`.mkv`, `.mp4`) et artworks (`folder.jpg`, `backdrop.jpg`, `logo.png`).
- [`backend/src/watcher/nfoParser.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/nfoParser.ts) : Parser XML `fast-xml-parser` robuste gérant les BOM UTF-8 et balises non standard.
- [`backend/src/watcher/tagExtractor.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/tagExtractor.ts) : Création et liaison idempotente des attributs/valeurs EAV aux médias.
- [`backend/src/watcher/rootConfig.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/rootConfig.ts) : Analyseur de variables `MEDIA_CHAOS_ROOT` multi-chemins.
- [`backend/src/watcher/slugify.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/slugify.ts) : Générateur d'identifiants lisibles et slugs SEO.
- [`backend/src/watcher/types.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/watcher/types.ts) : Typages TypeScript pour les structures `.nfo` parsées.

### 🛣️ Routes d'API (`backend/src/routes/`)
- [`backend/src/routes/ui.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/routes/ui.ts) : Server-Driven UI (`/api/ui/layout` et `/api/ui/tags`) alimentant dynamiquement les rails d'accueil.
- [`backend/src/routes/media.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/routes/media.ts) : Détail média (`/api/media/:id`), reprise de lecture (`/api/media/:id/progress`) et montage du routeur d'artworks.
- [`backend/src/routes/mediaArtworks.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/routes/mediaArtworks.ts) : Proxy d'artworks locaux (`/api/media/:id/poster`, `/api/media/:id/fanart`) servant les images physiques en HTTP avec cache.
- [`backend/src/routes/search.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/routes/search.ts) : Recherche floue trigramme ultra-rapide (`/api/search?q=...`) par médias, tags et personnes.
- [`backend/src/routes/iptv.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/routes/iptv.ts) : Liste des chaînes TV (`/api/iptv/channels`) et proxy HLS live CORS (`/api/iptv/stream/:id/live.m3u8`).
- [`backend/src/routes/cast.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/routes/cast.ts) : Endpoints de Cast multi-écrans (`/api/cast/devices`, heartbeat, files de commandes).
- [`backend/src/routes/admin.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/routes/admin.ts) : Administration du catalogue et réordonnancement des rails Server-Driven UI.
- [`backend/src/routes/auth.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/routes/auth.ts) : Authentification frictionless, profils et appairage TV Quick-Connect.

### 📡 Moteur Live IPTV (`backend/src/iptv/`)
- [`backend/src/iptv/m3uParser.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/iptv/m3uParser.ts) : Découpage et extraction des playlists `.m3u` / `.m3u8`.
- [`backend/src/iptv/xmltvParser.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/iptv/xmltvParser.ts) : Parser de grilles de programmes XMLTV.
- [`backend/src/iptv/channelIngester.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/iptv/channelIngester.ts) : Ingestion des flux TV en nœuds de catalogue `LIVE_CHANNEL`.

### 📺 Système de Cast Distant (`backend/src/cast/`)
- [`backend/src/cast/deviceRegistry.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/cast/deviceRegistry.ts) : Détection, registre en mémoire et commandes de lecture pour les écrans UMS.
- [`backend/src/cast/types.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/cast/types.ts) : Définitions TypeScript du protocole de Cast.

### 🌱 Seeder Initial Preset Kyoo (`backend/src/seed/`)
- [`backend/src/seed/kyooPreset.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/seed/kyooPreset.ts) : Injection out-of-the-box des 17 groupes de tags Kyoo et des rails d'accueil par défaut.
- [`backend/src/seed/attributesData.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/seed/attributesData.ts) : Définition des zones Kyoo (`HERO_BADGE`, `PRIMARY_PILL`, `PERSON_CAROUSEL`, `TECHNICAL_DRAWER`).
- [`backend/src/seed/railsData.ts`](file:///var/home/tele/Documents/theuniversalmediastack/backend/src/seed/railsData.ts) : Configuration initiale des rails Server-Driven UI.

---

## 📱 4. Frontend Universel & Responsive (`frontend/src/`)

### 🧭 Écrans Expo Router (`frontend/src/app/`)
- [`frontend/src/app/_layout.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/app/_layout.tsx) : Structure racine de navigation et thématique globale.
- [`frontend/src/app/index.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/app/index.tsx) : Écran d'accueil responsive avec carrousel Hero Spotlight et rails dynamiques.
- [`frontend/src/app/explore.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/app/explore.tsx) : Exploration du catalogue, barre de recherche et filtres par pilules de tags EAV.
- [`frontend/src/app/live.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/app/live.tsx) : Grille réactive des chaînes IPTV en direct avec indicateurs de statut.
- [`frontend/src/app/media/[id].tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/app/media/[id].tsx) : Fiche média complète organisée selon la hiérarchie des 4 zones de tags Kyoo.
- [`frontend/src/app/player/[id].tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/app/player/[id].tsx) : Lecteur universel, bouton *Passer l'intro*, mode récepteur et déclencheur de Cast.
- [`frontend/src/app/player/PlayerScreen.styles.ts`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/app/player/PlayerScreen.styles.ts) : Styles glassmorphes du lecteur vidéo.
- [`frontend/src/app/admin.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/app/admin.tsx) : Studio d'administration pour réorganiser les rails et synchroniser les listes IPTV.

### 🎨 Composants UI Réutilisables (`frontend/src/components/`)
- [`frontend/src/components/app-tabs.web.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/app-tabs.web.tsx) : Barre de navigation supérieure glassmorphe responsive (mode mobile compact / desktop).
- [`frontend/src/components/app-tabs.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/app-tabs.tsx) : Onglets natifs iOS/Android.
- [`frontend/src/components/HeroSpotlight.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/HeroSpotlight.tsx) : Grand bandeau vedette d'accueil avec tags de mise en avant et action directe.
- [`frontend/src/components/HeroSpotlight.styles.ts`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/HeroSpotlight.styles.ts) : Styles adaptatifs du Hero Spotlight (mobile/desktop).
- [`frontend/src/components/MediaRail.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/MediaRail.tsx) : Rail défilant horizontal de cartes médias avec badge de comptage.
- [`frontend/src/components/MediaCard.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/MediaCard.tsx) : Carte média responsive (format poster vertical, paysage ou carte live).
- [`frontend/src/components/MediaCard.styles.ts`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/MediaCard.styles.ts) : Styles avec glassmorphisme doux et coins arrondis.
- [`frontend/src/components/SearchBar.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/SearchBar.tsx) : Barre de recherche instantanée avec menu déroulant catégorisé.
- [`frontend/src/components/SearchBar.styles.ts`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/SearchBar.styles.ts) : Styles de la recherche dynamique.
- [`frontend/src/components/TagPill.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/TagPill.tsx) : Pilule de tag colorée respectant la charte ergonomique `bon_ux_ui.md`.
- [`frontend/src/components/CastModal.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/CastModal.tsx) : Modale glassmorphe de sélection des écrans récepteurs disponibles sur le réseau.
- [`frontend/src/components/CastControlBar.tsx`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/CastControlBar.tsx) : Mini-télécommande flottante pour contrôler la lecture à distance.
- [`frontend/src/components/CastModal.styles.ts`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/components/CastModal.styles.ts) : Styles de la modale de Cast.

### 🌐 Services & Intégration API (`frontend/src/services/`)
- [`frontend/src/services/api.ts`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/services/api.ts) : Appels réseau vers l'API Hono (`fetchHomeLayout`, `fetchMediaDetail`, `searchCatalog`, `resolveImageUrl`).
- [`frontend/src/services/castService.ts`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/services/castService.ts) : Client de Cast pour enregistrer l'écran et émettre des commandes distantes.
- [`frontend/src/services/types.ts`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/services/types.ts) : Interfaces TypeScript partagées (nœuds médias, tags EAV, rails de disposition).

### 📐 Thème & Charte Graphique (`frontend/src/constants/`)
- [`frontend/src/constants/theme.ts`](file:///var/home/tele/Documents/theuniversalmediastack/frontend/src/constants/theme.ts) : Palette ardoise bleutée `#0f172a`, arrondis doux (`Radius.sm` à `Radius.pill`), espacements et breakpoints responsives.

---

## 📖 5. Documents de Référence & Bonnes Pratiques

- [`white_paper_the_universal_media_stack.md`](file:///var/home/tele/Documents/theuniversalmediastack/white_paper_the_universal_media_stack.md) : Livre blanc complet décrivant la thèse atomique, l'in-place zero-loss et les 5 lois architecturales.
- [`bonne_pratique.md`](file:///var/home/tele/Documents/theuniversalmediastack/bonne_pratique.md) : Guide maître des agents IA (limite 100 lignes, modularité, double contrôle, gestion des volumes sur OS immuables).
- [`mauvaise_pratique.md`](file:///var/home/tele/Documents/theuniversalmediastack/mauvaise_pratique.md) : Registre des 13 anti-patterns identifiés et remédiés (erreurs inotify, bind mounts Bazzite, URIs locales).
- [`bon_ux_ui.md`](file:///var/home/tele/Documents/theuniversalmediastack/bon_ux_ui.md) : Charte ergonomique (glassmorphisme doux, cards aérées TDAH-friendly, zéro angle aigu).
- [`avancement_projet.md`](file:///var/home/tele/Documents/theuniversalmediastack/avancement_projet.md) : Tableau de bord exhaustif du statut des modules achevés et chantiers futurs.
- [`stack_universelle.md`](file:///var/home/tele/Documents/theuniversalmediastack/stack_universelle.md) : Description technique détaillée des schémas Drizzle et des endpoints exposés.
- [`sommaire.md`](file:///var/home/tele/Documents/theuniversalmediastack/sommaire.md) : Ce document de synthèse cartographique.
