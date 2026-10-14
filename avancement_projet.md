# 📊 État d'Avancement du Projet — The Universal Media Stack (v3.0)

Ce document trace l'avancement global du projet, les jalons validés et les chantiers en cours, conformément aux spécifications du White Paper et aux règles d'or de `bonne_pratique.md`.

---

## 🟢 1. Jalons Récents & Fonctionnalités Achevées

### 🗂️ Structure Catégories Verticales < Cards de Tags Verticales < Médias & Menu Flottant
- [x] **Tags sous forme de Cards Verticales (`TagCard.tsx`, `CategorySection.tsx`) :**
  - **Catégories listées verticalement :** Années de sortie, Genres, Qualité & Résolution, Thèmes & Univers, Studios.
  - **Tags listés verticalement sous forme de Cards :** Chaque tag est une Card indépendante contenant son en-tête (titre cliquable, compteur de médias, raccourci forum) et son contenu direct (médias et séries associés).
  - **Contenu de chaque Card de Tag (`MediaTile.tsx`) :** Médias (films, épisodes) et groupes de médias (séries) présentés en cases compactes avec image, badge de type, année et titre au bas de l'image.
  - **Affichage extensible :** Bouton pour étendre ou réduire les tags additionnels par catégorie.
- [x] **Menu Flottant avec Raccourcis Cliquables (`FloatingCategoryBar.tsx`) :**
  - Barre flottante en verre dépoli (`glassmorphism`) affichant les catégories disponibles (`📅 Années`, `🎭 Genres`, `⭐ Qualité`, `🏷️ Thèmes`, `🏢 Studios`).
  - Clic sur une catégorie $\rightarrow$ défilement fluide automatique (`scrollTo`) directement vers la zone ciblée de la page.

### 💬 Forum Interactif Universel Style WhatsApp (`forumRoutes.ts`, `app/forum/[topic].tsx`)
- [x] **Textes Cliquables Universels (`ClickableTopicText.tsx`, `TagPill.tsx`) :**
  - Tout élément textuel (titres de médias, tags de genres, années, noms d'acteurs, réalisateurs, mots-clés) est cliquable et ouvre un salon de discussion dédié au sujet `#topic`.
  - Bouton d'accès direct `💬 Forum WhatsApp` intégré sur les pages de détails médias et les rails de tags.
- [x] **Partage Multimédia Complet Style WhatsApp (`ForumInputBar.tsx`, `ForumMessageBubble.tsx`) :**
  - **Types de médias supportés :** Textes, Images (`IMAGE`), Vidéos (`VIDEO`), Notes Vocales/Audios (`AUDIO`), Documents & Fichiers (`DOCUMENT`), GIFs animés (`GIF`), Liens Web (`LINK`).
  - **Citations & Réponses de messages :** Clic sur `↩` pour citer un message antérieur avec aperçu stylisé de l'auteur et de l'extrait cité dans la bulle de discussion.
  - **Bulles de discussion WhatsApp :** Différenciation visuelle (messages émis en indigo à droite, messages reçus en ardoise à gauche), horodatage précis et défilement fluide.
- [x] **Persistance Relationnelle Indexée (`backend/src/db/schema/forum.ts`) :**
  - Table PostgreSQL `forum_messages` avec index sur `topic_slug` et `created_at`.
  - Endpoints REST `/api/forum/topics/:slug/messages` et `/api/forum/popular`.

### ⚙️ Centralisation & Synchronisation Modulaire `param.yaml`
- [x] **Fichier Central `param.yaml` :**
  - Centralisation stricte de l'intégralité des réglages du site (serveur, sécurité, UI, multimédia) à la racine du projet et accessible dans l'API (`/app/param.yaml`).
  - **Gestion Hybride Humain / Agent IA :** Modifiable directement depuis l'interface Web d'administration ou édité manuellement sur le disque par un agent IA.
  - **Rechargement Dynamique Hot-Reload :** Surveillance du fichier (`paramManager.ts`) pour prise en compte immédiate de tout changement externe sans redémarrer le serveur.
  - **Endpoints Dédiés (`/api/admin/config`, `/api/auth/config`) :** Lecture et écriture atomiques et synchronisées.

### 👥 Profils à la Volée, Rôle Administrateur Initial & Mode Invitation
- [x] **Création de Compte Immédiate à la Volée (`/api/auth/register-on-the-fly`) :**
  - Permet à tout nouvel utilisateur de se créer un profil en un clic (pseudo, code PIN optionnel, limite d'âge CSA) pour consulter immédiatement les médias.
  - **Premier Compte = Administrateur Suprême :** Si aucun utilisateur n'est présent dans la base de données, le premier compte créé devient automatiquement Administrateur avec tous les privilèges (`isAdmin: true`).
- [x] **Mode Sur Invitation Seule (`invitationOnly: true/false`) :**
  - L'administrateur peut à tout moment verrouiller son instance pour la rendre privée via l'interface admin ou directement dans `param.yaml`.
  - Contrôle et validation des codes d'invitation autorisés (`invitationCodes`).
  - Blocage immédiat avec message d'erreur clair si le code d'invitation est manquant ou incorrect.
- [x] **Gestion des Utilisateurs depuis l'Administration (`AdminUsersTab.tsx`, `/api/admin/users`) :**
  - Liste de tous les profils avec badges d'état (👑 Admin / 👤 Membre).
  - Modification des rôles, permissions et limites CSA.
  - Suppression de profil avec garde-fou strict empêchant la suppression ou rétrogradation du dernier administrateur actif.
- [x] **Composants Frontend Dédiés (`QuickProfileModal.tsx`, `SiteHeader.tsx`, `AdminConfigTab.tsx`) :**
  - En-tête de site responsive avec sélection de profil et bouton d'accès rapide.
  - Modale moderne et fluide pour créer son profil en quelques secondes.
  - Onglet d'administration complet pour configurer `param.yaml` en temps réel.

### 🚀 Compatibilité Double OS (Bazzite & Fedora)
- [x] **Script de Démarrage Unifié (`start.sh`) :**
  - Détection automatique de Bazzite (ostree immutable) et de Fedora standard.
  - Détection dynamique du moteur de conteneurs (`docker compose` ou `podman compose` avec socket utilisateur `/run/user/$UID/podman/podman.sock`).
  - Détection automatique de l'interpréteur JavaScript (`bun` ou `node`/`npm`).
  - Prise en charge stricte de SELinux (`:z`) sur tous les volumes bind.
  - Prise en compte des liens symboliques Bazzite (`/home` -> `/var/home`).
  - Respect strict de la règle des **fichiers de 100 lignes maximum** (script de 72 lignes).

### 📂 Stockage In-Place & Zéro Déplacement Physique
- [x] **Suppression définitive de `MEDIA_CLEAN_ROOT` :**
  - Aucun fichier utilisateur n'est déplacé, renommé ou altéré sur le disque.
  - La structure réelle des dossiers multimédias est préservée à 100 %.
- [x] **Support Multi-Dossiers `MEDIA_CHAOS_ROOT` :**
  - Possibilité de spécifier un ou plusieurs dossiers multimédias séparés par des virgules (ex: `/home/tele/Vidéos/drive`).
  - Détecteur de fichiers adjacents in-place (`watcher/mediaFileDetector.ts`) associant vidéos et artworks locaux.
  - **Crawler Récursif au Démarrage (`watcher/bootScanner.ts`) :** Découverte synchrone et ingestion immédiate de toute l'arborescence de fichiers `.nfo` préexistants (695 nœuds médias indexés).
  - **Proxy d'Artworks Locaux (`routes/mediaArtworks.ts`) :** Exposition HTTP sécurisée (`/api/media/:id/poster`, `/api/media/:id/fanart`).

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
- [x] Injection des rails d'accueil Kyoo par défaut.
- [x] Création du compte administrateur initial (`admin@ums.local`).

### 🧹 Nettoyage des Métadonnées & Normalisation des Titres (`watcher/titleCleaner.ts`)
- [x] **Algorithme d'extraction & nettoyage des titres :**
  - Priorisation intelligente du titre original (`originalTitle`) exempt de tags de release.
  - Nettoyage des motifs de tags de release (`1080p`, `720p`, `x264`, `x265`, `BDRip`, `BluRay`, `MULTi`, `VFF`, etc.).
  - Nettoyage des préfixes d'années (`1995.`, `2024.`) et des numéros de piste (`01 - `).
  - Préservation des acronymes avec points (ex: `G.I. Joe The Rise Of Cobra`).
  - Formatage standardisé des épisodes de séries TV : `<TitreSérie> - S<Saison>E<Episode>`.

### 🔄 Complétion Intelligente & Mise à Jour Prioritaire de la Médiathèque (`watcher/metadataEnricher.ts`)
- [x] **Algorithme de priorité par indice de besoin (`needScore`) :**
  - Classement dynamique des médias : les éléments sans synopsis, sans affiche ou sans note sont enrichis en priorité absolue.
  - Résolution multi-sources : TVmaze (séries/animes) et Wikipedia Opensearch / REST API (films) sans dépendance à une clé payante.
  - **Actualisation des métadonnées existantes :** Toute métadonnée trouvée lors de la requête externe est automatiquement mise à jour et persistée.
  - **Fonctionnalité d'Administration (`app/admin.tsx`) :** Bouton `🔄 Mettre à jour la médiathèque` avec spinner et feedback chiffré en temps réel.
  - **Webhook tinyMediaManager (`/api/media/webhook/tmm`) :** Réception des événements de scraping TMM pour ingestion immédiate.
  - **Synchronisation EPG (`/api/iptv/sync-epg`) :** Point d'entrée de mise à jour du guide des programmes.

### 📊 Exploration Enrichie & Statistiques du Catalogue (`routes/mediaStats.ts`, `components/ExploreStats.tsx`)
- [x] **Endpoint de Statistiques du Catalogue (`/api/media/stats`) :**
  - Décompte instantané par type : Films, Séries, Épisodes, Direct TV et Total.
  - Agrégation des top genres les plus représentés dans la bibliothèque.
  - Restitution des derniers ajouts pour éviter tout affichage de catalogue vide à l'état initial.
- [x] **Interface Explorer TDAH-Friendly :**
  - Affichage de cartes statistiques glassmorphes au repos.
  - Pilules de genres interactives alimentant automatiquement la barre de recherche.
  - Titres des médias multilignes avec retour à la ligne propre (`numberOfLines={2}`).

### 🎬 Streaming Vidéo & Lecteur HTML5 Intégré (`routes/mediaStream.ts`, `components/VideoPlayerView.tsx`)
- [x] **Streaming HTTP Range (206 Partial Content) :** Support du positionnement temporel (seek) fluide pour les fichiers MKV, MP4, WebM et redirection transparente vers les flux IPTV.
- [x] **Lecteur vidéo universel Web :** Intégration du composant `<video>` HTML5 avec contrôles, gestion lecture/pause réactive et bouton *Passer l'Introduction* fonctionnel (+85 secondes).
- [x] **Navigation réactive :** Déclencheurs de navigation fiables sur cartes, affiches et boutons *Regarder* / *Détails*.

---

## 🟡 2. Chantiers Suivants (Triés par Ordre de Priorité)

1. **Intégration du Transcodeur Matériel (`ums_transcoder`) :** Détection automatique des formats vidéo non supportés nativement par les navigateurs Web (ex: HEVC/x265 10-bit ou audio DTS) et bascule vers le transcodage matériel VAAPI / NVENC à la volée.
2. **Reconnaissance Visuelle et Chapitrage Automatique :** Détection temporelle automatique des intros de séries TV pour alimenter `chaptersJson` et déclencher le saut d'intro sans intervention utilisateur.
3. **Téléchargement Hors-Ligne & Profils Multi-Utilisateurs :** Synchronisation locale de fichiers multimédias pour lecture en déplacement hors réseau.
