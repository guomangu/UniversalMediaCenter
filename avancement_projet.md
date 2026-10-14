# 📊 État d'Avancement du Projet — The Universal Media Stack (v3.0)

Ce document trace l'avancement global du projet, les jalons validés et les chantiers en cours, conformément aux spécifications du White Paper et aux règles d'or de `bonne_pratique.md`.

---

## 🟢 1. Jalons Récents & Fonctionnalités Achevées

### 🚀 Compatibilité Double OS (Bazzite & Fedora)
- [x] **Script de Démarrage Unifié (`start.sh`) :**
  - Détection automatique de Bazzite (ostree immutable) et de Fedora standard.
  - Détection dynamique du moteur de conteneurs (`docker compose` ou `podman compose` avec socket utilisateur `/run/user/$UID/podman/podman.sock`).
  - Détection automatique de l'interpréteur JavaScript (`bun` ou `node`/`npm`).
  - Prise en charge stricte de SELinux (`:z`) sur tous les volumes bind.
  - Respect strict de la règle des **fichiers de 100 lignes maximum** (script de 72 lignes).

### 📂 Stockage In-Place & Zéro Déplacement Physique
- [x] **Suppression définitive de `MEDIA_CLEAN_ROOT` :**
  - Aucun fichier utilisateur n'est déplacé, renommé ou altéré sur le disque.
  - La structure réelle des dossiers multimédias est préservée à 100 %.
- [x] **Support Multi-Dossiers `MEDIA_CHAOS_ROOT` :**
  - Possibilité de spécifier un ou plusieurs dossiers multimédias séparés par des virgules (ex: `/media/chaos,/mnt/nas/films,/mnt/storage/series`).
  - Détecteur de fichiers adjacents in-place (`watcher/mediaFileDetector.ts`) associant vidéos et artworks locaux.

### 🗄️ Architecture Base de Données (PostgreSQL 16 + PostGIS + Drizzle ORM)
- [x] **Schéma Drizzle Modulaire (100% fichiers < 100 lignes) :**
  - `enums.ts` : `nodeTypeEnum`, `nodeStateEnum`, `tagZoneEnum`, `railTypeEnum`.
  - `spatial.ts` : Type spatial PostGIS natif `GEOMETRY(Point, 4326)`.
  - `nodes.ts` : Table `media_nodes` avec arbre récursif (`parent_id`), chapitres JSON (`INTRO`/`OUTRO`), et index de recherche trigramme `gin_trgm_ops`.
  - `eav.ts` : Modèle polymorphique EAV `eav_attributes`, `eav_values`, `node_eav_links`.
  - `rails.ts` : Modèle Server-Driven UI `ui_rails` avec filtres JSON dynamiques.
  - `users.ts` : RBAC + ABAC parental par tags (`max_csa_age_limit`, `blocked_value_ids`), et table `watch_progress`.
  - `iptv.ts` : `iptv_sources` et guide TV `epg_programs`.
- [x] **Migrations Automatisées Idempotentes (`db/migrate.ts`, `db/migrateSecondary.ts`) :**
  - Activation de `postgis`, `pg_trgm`, `unaccent`.
  - Création des tables et index trigrammes GIN sans duplication.

### 🌱 Bootstrapper & Preset Kyoo Natif (`seed/kyooPreset.ts`)
- [x] Seeder automatique au premier démarrage (`AUTO_SEED_KYOO_PRESET=true`).
- [x] Hiérarchie visuelle pré-ordonnée des groupes d'attributs (`HERO_BADGE`, `PRIMARY_PILL`, `PERSON_CAROUSEL`, `TECHNICAL_DRAWER`).
- [x] Injection des rails d'accueil Kyoo par défaut (Hero Spotlight, Reprendre la lecture, Ajouts Récents, Direct TV, Sagas, Cinéma 4K).
- [x] Création du compte administrateur initial (`admin@ums.local`).

### 🎬 Module A : Watcher .NFO Zéro-Perte In-Place (`watcher/`)
- [x] Surveillance temps réel Chokidar sur l'ensemble des dossiers déclarés dans `MEDIA_CHAOS_ROOT` (`watcher/index.ts`).
- [x] Hachage cryptographique SHA-256 pour éviter tout parsing superflu.
- [x] Parser XML `fast-xml-parser` (`watcher/nfoParser.ts`).
- [x] **Loi Zéro-Perte :** Extraction automatique de toute balise non standard en attribut `custom_<tag>` avec liaison EAV (`watcher/mediaIngester.ts`).
- [x] Reconstruction automatique de `search_vector_text` pour la recherche rapide.

### 🔍 Module B : Recherche Floue & Tolérante aux Fautes (`routes/search.ts`)
- [x] Recherche en `< 10 ms` via `pg_trgm` (`similarity` et `word_similarity`).
- [x] Résultats catégorisés instantanés : Médias (films/séries/épisodes), Pilules de Tags cliquables, et Personnes (acteurs/réalisateurs).

### 📡 Module C : Moteur Live IPTV & Guide EPG (`iptv/` & `routes/iptv.ts`)
- [x] Parser intelligent `.m3u` / `.m3u8` (`iptv/m3uParser.ts`).
- [x] Parser de guide TV `XMLTV` (`iptv/xmltvParser.ts`).
- [x] Transformation des flux en noeuds de catalogue `LIVE_CHANNEL` et tags EAV (`iptv/channelIngester.ts`).
- [x] Proxy de flux HLS avec en-têtes CORS (`/api/iptv/stream/:channelId/live.m3u8`).

### 🛡️ Module D : RBAC & Sécurité Frictionless (`middleware/access.ts` & `routes/auth.ts`)
- [x] Middleware d'authentification et permissions.
- [x] Sécurité par code PIN et appairage TV Quick-Connect.

### 📺 Module E : Système de Cast Complet & Multi-Écrans (`cast/` & `routes/cast.ts`)
- [x] **Registry de Périphériques Actifs (`cast/deviceRegistry.ts`) :** Détection automatique des écrans UMS sur le réseau avec heartbeat et expiration TTL.
- [x] **File d'Attente de Commandes Distantes :** Synchronisation bidirectionnelle (`LOAD`, `PLAY`, `PAUSE`, `SEEK`, `STOP`).
- [x] **Multi-Protocoles :**
  - **UMS Connect :** Diffusion sans fil instantanée vers n'importe quel écran UMS (Salon TV, chambre, autre navigateur).
  - **Google Cast / Chromecast :** Prise en charge des diffuseurs Google Cast.
  - **AirPlay :** Prise en charge sans fil Apple (Apple TV, Mac, iPhone).
- [x] **Composants Frontend :**
  - `CastModal.tsx` : Modale glassmorphe de sélection d'écrans avec handoff de position.
  - `CastControlBar.tsx` : Mini-télécommande flottante pour contrôler la lecture à distance.
  - `player/[id].tsx` : Mode récepteur automatique pour lire les flux reçus.

### 📱 Module F : Frontend Universel Kyoo-Style (Expo / React Native)
### 📺 Module E : Système de Cast Complet & Multi-Écrans (`cast/` & `routes/cast.ts`)
- [x] **Registry de Périphériques Actifs (`cast/deviceRegistry.ts`) :** Détection automatique des écrans UMS sur le réseau avec heartbeat et expiration TTL.
- [x] **File d'Attente de Commandes Distantes :** Synchronisation bidirectionnelle (`LOAD`, `PLAY`, `PAUSE`, `SEEK`, `STOP`).
- [x] **Multi-Protocoles :** UMS Connect (écrans du réseau), Google Cast / Chromecast, et AirPlay.
- [x] **Composants Frontend :** Modale glassmorphe `CastModal.tsx` et mini-télécommande `CastControlBar.tsx`.

### 📱 Module F : Frontend Universel Kyoo-Style (Expo / React Native)
- [x] Charte d'excellence `bon_ux_ui.md` respectée : glassmorphisme, ardoise bleutée `#0f172a`, zéro coin aigu (`Radius` 12-24px et pilules 9999px), TDAH-friendly.
- [x] Accueil dynamique piloté par le serveur (`app/index.tsx`) avec carrousel Hero Spotlight et rails défilants.
- [x] Onglet Exploration avec recherche instantanée et filtres par tags (`app/explore.tsx`).
- [x] Écran Direct TV avec grille temporelle et cartes de chaînes (`app/live.tsx`).
- [x] Fiche média détaillée (`app/media/[id].tsx`) avec hiérarchie des 4 zones de tags Kyoo.
- [x] Lecteur vidéo unifié (`app/player/[id].tsx`) avec bouton flottant *Skip Intro*.
- [x] Studio d'administration Server-Driven UI (`app/admin.tsx`) pour réordonner les rails et synchroniser les sources IPTV.

---

## 🟡 2. Chantiers Suivants

1. **Intégration du Transcodeur Matériel :** Raccordement direct au conteneur `ums_transcoder` pour le transcodage matériel VAAPI / NVENC à la volée.
2. **tinyMediaManager HTTP Hook :** Déclenchement automatique de l'ingestion NFO via webhook lors de la complétion du scraping TMM.
3. **Synchronisation EPG Périodique :** Cron automatique de rafraîchissement des programmes TV dans `epg_programs`.
