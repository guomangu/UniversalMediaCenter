# WHITE PAPER : THE UNIVERSAL MEDIA STACK (v3.0)
**AI-Native. File-Based. Zero-Config Kyoo UI + Jellyfin Engine.**

> **Thèse Architecturale :** Les serveurs multimédias actuels imposent un compromis frustrant : choisir entre l'élégance moderne mais rigide de **Kyoo** et la richesse fonctionnelle (Live IPTV, RBAC, administration) mais vieillissante de **Jellyfin**. **The Universal Media Stack** fusionne le meilleur des deux mondes sur une fondation Full-TypeScript (**Expo + Hono + Drizzle + PostgreSQL 16 / PostGIS**). 
>
> **La Promesse "Zero-Config Day 1, Infinite-Config Day 2" :** Au premier lancement (`docker compose up`), le système génère automatiquement une interface cinématographique complète, ordonnée et prête à l'emploi, identique à Kyoo, sans aucune configuration manuelle requise. Par la suite, chaque rail, chaque groupe de tags, chaque flux IPTV et chaque permission utilisateur est intégralement modifiable à chaud depuis le Back-Office d'administration (*Server-Driven UI*).

---

## Table des Matières
1. [Philosophie & Architecture Globale](#1-philosophie--architecture-globale)
2. [Le Principe "Zero-Config Out-of-the-Box" (Preset Kyoo Natif)](#2-le-principe-zero-config-out-of-the-box-preset-kyoo-natif)
3. [Loi n°1 : Zéro Perte de Données (Destructuration `.nfo` $\rightarrow$ EAV)](#3-loi-n1--zéro-perte-de-données-destructuration-nfo--eav)
4. [Loi n°2 : Recherche Floue & Tolérante aux Fautes ($< 10\text{ ms}$)](#4-loi-n2--recherche-floue--tolérante-aux-fautes--10-ms)
5. [Loi n°3 : Server-Driven UI & Ordonnancement Modulaire](#5-loi-n3--server-driven-ui--ordonnancement-modulaire)
6. [Loi n°4 : Moteur IPTV Live (`.m3u` + Guide EPG `XMLTV`)](#6-loi-n4--moteur-iptv-live-m3u--guide-epg-xmltv)
7. [Loi n°5 : Sécurité Frictionless, RBAC, ABAC & Partitionnement Physique PBAC](#7-loi-n5--sécurité-frictionless-rbac-abac--partitionnement-physique-pbac)
  * 7.1. Authentification Multi-Écrans Sans Mot de Passe
  * 7.2. Matrice des Capacités Système (RBAC)
  * 7.3. Contrôle Parental Sémantique & Quotas (ABAC par Tags & Plafond CSA)
  * 7.4. Partitionnement Inviolable des Dossiers Physiques (PBAC - Path-Based Access Control)
  * 7.5. Présentation UI & Server-Driven Taxonomie Zéro-Vide
  * 7.6. Écosystème Social, Amis & Présence en Temps Réel (YouTube-Grade)
  * 7.7. Watch Party Synchronisée & Salons Culturels Multidimensionnels
  * 7.8. Diffusion Sans Fil Cast (Google Cast / W3C) & Autonomie PWA Hors-Ligne
  * 7.9. Embarquement 1-Clic par Invitations Magiques Dynamiques
8. [Checklist Exhaustive des Fonctionnalités (Parité Kyoo + Jellyfin++)](#8-checklist-exhaustive-des-fonctionnalités-parité-kyoo--jellyfin)
9. [Infrastructure Conteneurisée Complète (`compose.yaml` & `Caddyfile`)](#9-infrastructure-conteneurisée-complète-composeyaml--caddyfile)
10. [Schéma de Base de Données Référence (`Drizzle ORM`)](#10-schéma-de-base-de-données-référence-drizzle-orm)
11. [Master Prompt : Cahier des Charges pour l'Agent IA Autonome](#11-master-prompt--cahier-des-charges-pour-lagent-ia-autonome)

---

## 1. Philosophie & Architecture Globale

L'architecture repose sur la séparation stricte entre **la persistance physique (le disque)**, **l'indexation relationnelle/spatiale (PostgreSQL 16)** et **le rendu universel (Expo)**.

| Couche | Technologie | Rôle Stratégique |
| :--- | :--- | :--- |
| **Frontend Universel** | **Expo / React Native** (`expo-video`, `expo-file-system`) | Application unique compilée pour Web (SSR), iOS, Android et Android TV / Apple TV. |
| **Routage Unifié** | **Expo Router** | Deep-linking natif (`/media/[slug]`, `/explore?tags=...`, `/live/[channel]`, `/admin`). |
| **API & Orchestration** | **Hono (TypeScript / Bun)** | RPC typé de bout en bout, Watcher `.nfo` temps réel, Proxy HLS/IPTV, RBAC Middleware. |
| **ORM & Typage** | **Drizzle ORM** | Schéma déclaratif en TypeScript partagé entre le serveur Hono et le client Expo. |
| **Base de Données** | **PostgreSQL 16 + PostGIS + `pg_trgm`** | Arbre récursif `media_nodes`, facettes EAV indexées GIN, recherche floue par trigrammes et indexation spatiale GIST. |
| **Curation & Sidecars** | **tinyMediaManager (TMM)** | Nettoyage des dossiers chaotiques, renommage atomique, extraction `libmediainfo`, écriture des `.nfo` et artworks locaux. |
| **Moteur de Streaming** | **Kyoo Transcoder** *(ou Go-Transcode)* | Transcodage matériel à la volée (VAAPI / NVENC / QuickSync), extraction des sous-titres `.ass`/`.srt` et chapitres en HLS. |
| **Gateway & Direct Play** | **Caddy 2** | Reverse proxy automatique, support `HTTP Range` et téléchargement hors-ligne zéro-CPU via `X-Accel-Redirect`. |

---

## 2. Le Principe "Zero-Config Out-of-the-Box" (Preset Kyoo Natif)

Un serveur média ne doit jamais afficher une page blanche ou demander deux heures de paramétrage après son installation. Dès le premier démarrage du conteneur `api`, un **Bootstrapper / Seeder Idempotent** injecte automatiquement le **"Kyoo Default Preset"** dans PostgreSQL :

### 2.1. Disposition d'Accueil Pré-configurée (Rails par défaut)
Sans aucune intervention de l'administrateur, la page d'accueil est immédiatement structurée avec l'esthétique sombre et cinématographique de Kyoo :
1. **Hero Spotlight Dynamique (`HERO_BANNER`) :** Carrousel plein écran sélectionnant aléatoirement 5 œuvres récemment ajoutées disposant d'un `fanart.jpg` et d'un `clearlogo.png`, affichant le synopsis, le badge CSA, la résolution (`4K` / `HDR`) et le bouton de lecture directe.
2. **Rail 1 — Reprendre la lecture (`CONTINUE_WATCHING`) :** Apparaît automatiquement dès qu'un utilisateur a commencé une vidéo ou un épisode.
3. **Rail 2 — Ajouts Récents (`RECENTLY_ADDED`) :** Les derniers films, séries ou épisodes détectés par le Watcher `.nfo`.
4. **Rail 3 — Télévision en Direct (`LIVE_TV_FAVORITES`) :** S'active automatiquement dès qu'une source `.m3u` est présente (masqué proprement si aucune playlist IPTV n'est configurée).
5. **Rail 4 — Sagas & Collections (`COLLECTIONS_TREE`) :** Regroupe automatiquement les œuvres liées par une balise `<set>` dans le `.nfo`.
6. **Rails 5 à 8 — Exploration Automatique par Genres & Qualité :** Rails générés dynamiquement selon le contenu réel de votre disque (ex: *"Cinéma 4K HDR"*, *"Science-Fiction & Cyberpunk"*, *"Animation & Seinen"*, *"Les Mieux Notés"*).

### 2.2. Hiérarchie Visuelle des Tags Pré-ordonnée
Sur chaque fiche média (`/media/[id]`), le Seeder configure par défaut l'ordre exact d'apparition des métadonnées extraites du `.nfo` :
* **Zone 1 — Badges Hero (Sous le titre) :** `Année` $\rightarrow$ `Certification CSA` (avec code couleur d'alerte : Vert, Ambre `-12`, Rouge `-16`/`-18`) $\rightarrow$ `Durée` $\rightarrow$ `Qualité Vidéo` (`4K`, `HDR10`, `HEVC`) $\rightarrow$ `Note TMDB/IMDb`.
* **Zone 2 — Pilules Cliquables Principales (Sous le synopsis) :** `Genres` (Couleur Primaire) $\rightarrow$ `Sujets / Mots-clés` (Style Glassmorphism Kyoo) $\rightarrow$ `Studios` $\rightarrow$ `Pays`.
* **Zone 3 — Carrousels Humains :** `Réalisateurs & Scénaristes` $\rightarrow$ `Casting (Acteurs avec photo locale/TMDB et nom du personnage)`.
* **Zone 4 — Tiroir Technique ("Informations Fichier & Flux") :** Toutes les pistes `Audio`, `Sous-titres`, `Bitrate`, `Chemin du fichier`, `Identifiants externes` et toutes les balises XML personnalisées (`custom_*`).

> **Personnalisation Jour 2 :** Dès que l'administrateur ouvre `/admin/ui-builder`, il retrouve cette configuration exacte sous forme de blocs **Drag & Drop**. Il peut déplacer un groupe de tags de la Zone 4 vers la Zone 1, changer sa couleur, le masquer, ou réordonner les rails d'accueil en temps réel.

---

## 3. Loi n°1 : Zéro Perte de Données (Destructuration `.nfo` $\rightarrow$ EAV)

Lorsque **tinyMediaManager (TMM)** traite un dossier chaotique, il produit un fichier `.nfo` (XML) riche à côté du fichier vidéo. Le Watcher de Hono suit une règle absolue : **100 % des balises présentes dans le fichier `.nfo` doivent être persistées sous forme de tags EAV interrogeables.**

### 3.1. Algorithme d'Ingestion en 3 Passes
1. **Passe Structurelle & Spatiale :** Création ou mise à jour du nœud dans `media_nodes` (calcul du hash `SHA-256` du fichier `.nfo` pour éviter tout travail inutile si le fichier n'a pas changé). Si le `.nfo` contient des coordonnées géographiques ou des lieux de tournage connus, ils sont convertis en géométrie **PostGIS** (`POINT(lng lat)`).
2. **Passe Taxonomique Standardisée :** Extraction des balises connues vers les groupes d'attributs natifs (`certification`, `genre`, `subject`, `person`, `studio`, `country`, `video_codec`, `hdr_format`, `audio_language`, `subtitle_language`, `chapter`).
3. **Passe "Dynamic Catch-All" (Zéro Perte) :** Le parser XML parcourt récursivement toutes les balises restantes du `.nfo` qui ne figurent pas dans la liste standard. Pour chacune d'elles :
   * Il crée à la volée (si inexistant) un attribut dans `eav_attributes` avec le groupe `custom_metadata` (ex: `custom_aspectratio`, `custom_edition`, `custom_top250`, `custom_award`).
   * Il lie la valeur au média dans `eav_values`. Ainsi, même une balise exotique ajoutée manuellement ou par un plugin TMM devient immédiatement un tag recherchable et affichable dans l'interface !

---

## 4. Loi n°2 : Recherche Floue & Tolérante aux Fautes ($< 10\text{ ms}$)

La barre de recherche globale de l'application (accessible via `Cmd+K` / `Ctrl+K` sur Web ou depuis l'onglet Recherche sur Mobile/TV) offre une tolérance totale aux fautes de frappe, aux accents manquants et aux inversions de syllabes.

### 4.1. Moteur Hybride Trigrammes (`pg_trgm`) + Phonétique (`fuzzystrmatch`)
Au lieu de faire de simples `ILIKE '%query%'` qui échouent à la moindre faute d'orthographe, PostgreSQL 16 maintient un index **GIN Trigram** sur une colonne calculée `search_document` regroupant :
$$\text{Search Document} = \text{Unaccent}(\text{Titre} \parallel \text{Titre Original} \parallel \text{Acteurs} \parallel \text{Rôles} \parallel \text{Réalisateurs} \parallel \text{Tags EAV})$$

### 4.2. Formule de Pertinence (Ranking Score)
Lorsqu'un utilisateur tape une requête $q$, le score de pertinence $S(d, q)$ de chaque média ou tag $d$ est calculé nativement en SQL en moins de $10\text{ ms}$ :
$$S(d, q) = 0.5 \cdot \text{word\_similarity}(\text{unaccent}(q), d_{\text{title}}) + 0.3 \cdot \text{similarity}(\text{unaccent}(q), d_{\text{tags}}) + 0.2 \cdot \mathbb{I}_{\text{prefix}}(q, d_{\text{title}})$$

* Taper `"vincen casel"` remonte instantanément la fiche personne **Vincent Cassel** ainsi que tous ses films (*La Haine*, *Irréversible*).
* Taper `"csa 12"` ou `"4k hdr"` propose directement les pilules de tags correspondantes et filtre la grille en direct.
* Taper `"bfm"` ou `"arte"` affiche en tête les chaînes **Live IPTV** correspondantes avec l'émission en cours.

---

## 5. Loi n°3 : Server-Driven UI & Ordonnancement Modulaire

Contrairement à Kyoo où l'interface nécessite de modifier le code source Frontend pour changer l'agencement, l'application Expo agit comme un **moteur de rendu dynamique** guidé par le JSON renvoyé par Hono (`GET /api/ui/config`).

### 5.1. Ce que l'Administrateur peut modifier en direct depuis `/admin/layout`
1. **Constructeur de Pages & Rails (Home, Films, Séries, Live TV) :**
   * Ajouter, dupliquer, activer/désactiver ou réordonner les rails par glisser-déposer (`sort_order`).
   * Définir chaque rail via un **Constructeur Visuel de Requête de Tags** :
     * *Opérateurs logiques :* `INCLUDE ALL (AND)`, `INCLUDE ANY (OR)`, `EXCLUDE (NOT)`.
     * *Exemple concret :* Créer un rail intitulé *"Soirée Frissons (Interdit aux moins de 12 ans)"* configuré avec : `Genre IN ['Horreur', 'Thriller']` **AND** `Certification IN ['CSA : -12', 'CSA : -16']` **NOT** `Watched = true`, trié par `Note IMDb DESC`.
   * Choisir le **Style Visuel du Rail** : `POSTER_VERTICAL` (2:3), `THUMBNAIL_LANDSCAPE` (16:9 style épisodes/YouTube), `HERO_CAROUSEL`, `SQUARE_LOGO` (Idéal pour les chaînes IPTV), ou `COMPACT_TAG_CLOUD`.
2. **Gestionnaire de Taxonomie & Groupes de Tags (`/admin/tags`) :**
   * Réordonner l'importance des groupes de tags (`display_order`).
   * Fusionner deux tags synonymes (ex: fusionner `Sci-Fi` et `Science-Fiction`) : le backend met à jour la base Drizzle et peut optionnellement réécrire le fichier `.nfo` source.
   * Attribuer des icônes Lucide et des palettes de couleurs (`badge_variant`) à certains tags spécifiques (ex: mettre le tag `Dolby Vision` en violet doré, ou `CSA : -18` en rouge vif).

---

## 6. Loi n°4 : Moteur IPTV Live (`.m3u` + Guide EPG `XMLTV`)

Pour offrir la fonctionnalité TV en direct de Jellyfin directement dans l'interface Kyoo, le système intègre un pipeline complet de télévision par IP compatible avec toutes les listes `.m3u` publiques (comme les dépôts GitHub `iptv-org/iptv`) ou privées.

### 6.1. Ingestion & Transformation des Playlists `.m3u` en Nœuds & Tags
Lorsqu'un administrateur ajoute une URL `.m3u` (ex: `https://iptv-org.github.io/iptv/countries/fr.m3u`) et une URL `XMLTV` (guide des programmes) dans `/admin/iptv` :
1. **Parsing Intelligent :** Le worker Hono extrait chaque directive `#EXTINF:-1 tvg-id="..." tvg-name="..." tvg-logo="..." group-title="..." tvg-language="..."`.
2. **Unification du Catalogue :** Chaque chaîne est insérée dans `media_nodes` avec `node_type = 'LIVE_CHANNEL'`.
   * Le `group-title` (ex: `Actualités`, `Sport`, `Cinéma`, `Documentaires`) devient un **Tag EAV** de groupe `iptv_category`.
   * Le pays (`tvg-country`) et la langue (`tvg-language`) deviennent des **Tags EAV**.
   * Si la chaîne contient une information géographique locale (ex: *France 3 Grand Est / Alsace*), elle est rattachée à une coordonnée **PostGIS**, permettant de filtrer les chaînes locales sur la carte !
3. **Synchronisation EPG (Guide TV Électronique) :** Le parser `XMLTV` peuple la table `epg_programs`. L'interface affiche en temps réel sur chaque carte de chaîne **le programme en cours**, la **barre de progression temporelle** (ex: *20h50 — 22h30*) et le programme suivant.

### 6.2. Le Proxy de Flux Live Hono (Zéro blocage CORS / Codec)
Regarder un flux IPTV `.m3u8` ou `.ts` directement dans un navigateur Web échoue souvent à cause de trois problèmes : les en-têtes **CORS** bloqués par le serveur distant, le **Mixed Content** (flux `http://` appelé depuis votre site en `https://`), ou les flux **MPEG-TS bruts** non supportés par le lecteur natif HTML5.
* **La Solution Intégrée :** L'application Expo ne contacte jamais l'URL IPTV externe directement. Elle appelle `GET /api/iptv/stream/:channelId/live.m3u8`.
* **Comportement du Proxy Hono :**
  * Si le flux distant est déjà du HLS (`.m3u8`) propre, Hono réécrit les URLs relatives des segments `.ts` à la volée et les proxifie avec les bons en-têtes CORS.
  * Si le flux distant est un flux continu brut (`MPEG-TS` ou `RTMP`) ou possède un codec audio incompatible navigateur (ex: `AC3` sur Safari), Hono délègue le flux au conteneur **`transcoder` (FFmpeg)** qui l'encapsule à la volée en HLS ultra-basse latence (`LL-HLS`).

---

## 7. Loi n°5 : Sécurité Frictionless, RBAC, ABAC & Partitionnement Physique PBAC

L'authentification et la gestion des droits sont conçues pour être invisibles au quotidien (façon Netflix/Kyoo) tout en offrant la rigueur d'administration, de cloisonnement et de partitionnement d'un Jellyfin d'entreprise.

### 7.1. Authentification Multi-Écrans Sans Mot de Passe
* **Magic Links & Codes PIN à 4/6 chiffres :** Connexion rapide par e-mail ou changement de profil instantané dans le salon via un code PIN Argon2.
* **Appairage TV par QR Code (`Quick Connect`) :** Sur un téléviseur ou un navigateur neuf, l'écran affiche un code à 6 caractères et un QR Code. L'utilisateur le scanne avec son téléphone déjà connecté pour autoriser la session instantanément.

### 7.2. Matrice des Capacités Système (RBAC)
Depuis `/admin/users`, l'administrateur configure chaque utilisateur ou profil familial selon ses permissions fonctionnelles :
* `isAdmin` : Accès complet au back-office (UI Layout Builder, IPTV, TMM, Utilisateurs, Maintenance).
* `canDownload` : Autorise ou masque le bouton de téléchargement hors-ligne direct (`X-Accel-Redirect`).
* `canTranscode` : Autorise l'utilisation du GPU pour le transcodage matériel à la volée (ou restreint au Direct Play pur).
* `canWatchIptv` : Active ou désactive l'accès aux chaînes IPTV en direct (`LIVE_CHANNEL`).
* `maxConcurrentStreams` : Plafonne le nombre de lectures vidéo simultanées (ex: `2` ou `3` flux).

### 7.3. Contrôle Parental Sémantique & Quotas (ABAC par Tags & Plafond CSA)
* **Plafond d'Âge CSA (`maxCsaAgeLimit`) :** Si un profil "Enfant" ou "Adolescent" est réglé sur un plafond d'âge (ex: `10` ou `12` ans), le moteur SQL et le filtre mémoire excluent automatiquement toutes les œuvres portant une classification supérieure (`CSA : -12`, `CSA : -16` ou `CSA : -18`).
* **Whitelist & Blacklist de Tags EAV (`allowedTags` / `blockedTags`, `allowedValueIds` / `blockedValueIds`) :** Possibilité d'exclure un thème ou mot-clé sensible (ex: exclure `Horreur`, `Gore`, `Violence`) ou de restreindre un compte invité à une liste blanche exclusive (ex: uniquement `Collection : Dessins Animés`).

### 7.4. Partitionnement Inviolable des Dossiers Physiques (PBAC - Path-Based Access Control)
Pour garantir une étanchéité absolue des bibliothèques physiques sur le disque (ex: séparer `Films`, `Séries`, `Adultes`, `Privé`, `Enfants`), le système intègre un moteur de contrôle d'accès par chemins physiques :
1. **Règles Whitelist & Blacklist de Répertoires (`allowedFolders` / `blockedFolders`) :**
   * **Whitelist (`allowedFolders`) :** Si configurée, l'utilisateur ne peut voir et lire QUE les médias résidant sous ces répertoires physiques.
   * **Blacklist (`blockedFolders`) :** Interdiction stricte de tout média situé dans les dossiers spécifiés, même s'ils partagent des tags communs avec d'autres œuvres autorisées.
2. **Normalisation Symétrique Multi-OS (`/var/home` $\leftrightarrow$ `/home`) :**
   * Prise en charge native et transparente des alias de montage immuables (Fedora Silverblue, Bazzite, Atomic Desktop où `/home` est un lien symbolique vers `/var/home`).
   * Normalisation Unicode NFC et détection stricte des frontières de segments (`/Films` matche `/home/tele/Vidéos/drive/Films` mais ne crée pas de faux positif sur `/FilmsDocumentaires`).
3. **Héritage Arborescent Hermétique (`SHOW`, `COLLECTION`, `SEASON`) :**
   * Les conteneurs logiques n'ayant pas de fichier vidéo direct héritent de l'`effectivePhysicalPath` et des chemins de leurs enfants (`childPaths`). Si le dossier physique d'une série ou l'ensemble de ses épisodes appartient à un dossier interdit, le conteneur `SHOW` ou `COLLECTION` parent est intégralement bloqué.
4. **Architecture à Double Barrière (Loi Zero-Leak) :**
   * **Barrière 1 (SQL Amont) :** `buildMediaAccessConditions(user, tableAlias)` injecte des clauses `WHERE` dynamiques dans PostgreSQL pour garantir une pagination et des compteurs exacts sans surcoût.
   * **Barrière 2 (Mémoire Souveraine) :** `isMediaAllowedForUser(user, media)` effectue un contrôle JavaScript hermétique avant chaque rendu ou flux de streaming.

### 7.5. Présentation UI & Server-Driven Taxonomie Zéro-Vide
* **Masquage Dynamique des Catégories Orphelines :** Sur l'écran d'accueil, aucune catégorie de tags ne s'affiche si elle ne contient aucun média accessible pour l'utilisateur connecté ou selon le filtre actif.
* **Synchronisation Réactive de l'En-tête (`SiteHeader`) :** Les pastilles de raccourcis (`chips`) ne présentent que les catégories réellement peuplées, avec repli automatique de l'onglet actif.
* **Isolation Stricte du Cache Client PWA :** Les clés de stockage local sont partitionnées par utilisateur (`tax_v7_${userKey}_...`) avec purge automatique intégrale lors de la déconnexion ou du changement de profil.

### 7.6. Écosystème Social, Amis & Présence en Temps Réel (YouTube-Grade)
Pour transcender le modèle des serveurs statiques, la plateforme intègre une dimension sociale vivante et fluide :
* **Favoris Intelligents & Filtres Spécifiques :** Organisation personnelle des œuvres avec filtrage instantané (« Tous », « Films », « Séries »), mise en cache optimiste et toggle en un clic sur la fiche média (`🤍 Ajouter` $\leftrightarrow$ `❤️ Dans mes favoris`).
* **Présence & Activité en Direct (`isOnline` & `currentActivity`) :** Détection temps réel des amis connectés (pastille verte pulsante) et du média qu'ils sont en train de visionner avec bouton d'embarquement immédiat `🍿 Regarde : [Titre] ➔ Rejoindre ▶`.
* **Messagerie Directe Canonique (Salons DM 1-on-1) :** Algorithme déterministe de slug ordonné lexicographiquement (`dm-${[u1, u2].sort().join('-')}`) assurant un fil de conversation mutuel, sécurisé par le contrôle d'accès `canAccessPrivateTopic` (amitié réciproque acceptée).
* **Fil d'Avis & Micro-Critiques :** Système de notation de 1 à 5 étoiles (`★ 4.8 / 5`), calcul de la moyenne communautaire et flux d'avis multi-filtres (« Tous les avis », « Amis », « Mes avis ») avec persistance idempotente (Upsert).

### 7.7. Watch Party Synchronisée & Salons Culturels Multidimensionnels
* **Séances de Visionnage Partagé (Ciné-club en Direct) :** Gestion d'état de séances collectives (`sessions`, `session_participants`) avec synchronisation de timeline, assignation d'hôte, heartbeat glissant (25s) et clôture automatique des sessions abandonnées.
* **Associations Culturelles Quadri-Dimensionnelles :** Contextualisation automatique des salons de forum reliant en temps réel : 1. *Œuvres associées*, 2. *Personnalités & acteurs*, 3. *Studios de production*, et 4. *Genres & origines géographiques*.
* **Salon d'Appels Vocaux Continus (`LiveVoiceRoomBar`) :** Capture micro et streaming in-place en continu sans rupture, découpé en tranches Opus 2.5s et diffusé automatiquement entre spectateurs connectés.

### 7.8. Diffusion Sans Fil Cast (Google Cast / W3C) & Autonomie PWA Hors-Ligne
* **Google Cast & W3C Remote Playback :** Détection automatique des téléviseurs et récepteurs Chromecast sur le réseau local avec télécommande multimédia synchronisée en temps réel (`CastControlBar`).
* **Architecture PWA Triple-Couche Zéro-Délai :** Démarrage instantané à 0 ms et autonomie hors-ligne grâce à une stratégie de cache avancée : Cache-First sur 100% des artworks (`/poster`, `/fanart`) et Stale-While-Revalidate sur toutes les requêtes d'API, complété par un indicateur feutré de mode déconnecté (`OfflineIndicator`).

### 7.9. Embarquement 1-Clic par Invitations Magiques Dynamiques
* **Liens d'Invitation Instantanés (`/invite/:token`) :** Partage 1-clic générant une page responsive optimisée WhatsApp/Instagram avec cartes Open Graph et auto-authentification immédiate dans le navigateur (`localStorage`).
* **Création d'Invitations Personnalisées (`AdminCreateInviteModal`) :** Attribution préalable du pack de profil, identifiant et mot de passe personnalisable depuis le Back-Office.

---

## 8. Checklist Exhaustive des Fonctionnalités (Parité Kyoo + Jellyfin)

Voici la liste de contrôle complète que votre plateforme couvre nativement :

| Catégorie | Fonctionnalité | Origine | Statut dans l'Architecture |
| :--- | :--- | :--- | :--- |
| **Catalogue & Métadonnées** | Lecture 100 % File-Based via sidecars `.nfo` et images locales (`poster`, `fanart`, `clearlogo`, `thumb`) | Kyoo / Kodi | **Natif (Zéro perte XML)** |
| **Catalogue & Métadonnées** | Support des Sagas, Collections, Saisons, Épisodes, OAV/Spéciaux et numérotation absolue (Anime) | Kyoo | **Natif (Arbre récursif SQL)** |
| **Catalogue & Métadonnées** | Affichage des acteurs avec leur rôle exact et page dédiée par personne (Filmographie locale) | Kyoo | **Natif (Facettes EAV JSONB)** |
| **Catalogue & Métadonnées** | Tous les éléments scrappés (CSA, Genres, Sujets, Studios, Qualité, Codecs) transformés en Tags cliquables | Kyoo++ | **Natif (EAV + Catch-All)** |
| **Recherche & Exploration** | Barre de recherche instantanée tolérante aux fautes de frappe (`pg_trgm` + `unaccent`) | Sur-mesure | **Natif ($< 10\text{ ms}$)** |
| **Recherche & Exploration** | Explorateur multi-facettes (combiner plusieurs tags + tri + filtre géographique PostGIS) | Sur-mesure | **Natif** |
| **Interface & UI** | Interface sombre cinématographique pré-configurée dès l'installation (*Zero-Config Preset*) | Kyoo | **Natif (Database Seeder)** |
| **Interface & UI** | Réorganisation complète des rails d'accueil et de l'ordre des tags depuis le Back-Office | Sur-mesure | **Natif (Server-Driven UI)** |
| **Lecteur Vidéo** | Direct Play, Direct Remux (MKV $\rightarrow$ HLS) et Transcodage Matériel (VAAPI/NVENC) | Kyoo / Jellyfin | **Natif (`kyoo_transcoder`)** |
| **Lecteur Vidéo** | Rendu fidèle des sous-titres stylisés `.ass` / `.ssa` (polices incluses) et `.srt` / `.vtt` | Kyoo | **Natif** |
| **Lecteur Vidéo** | Marquage des chapitres sur la timeline + Bouton automatique *"Passer l'intro / Générique"* | Kyoo / Jellyfin | **Natif** |
| **Lecteur Vidéo** | Synchronisation temps réel de la progression (Reprise multi-appareils) & statut Vu/Non-vu | Kyoo / Jellyfin | **Natif** |
| **Téléchargement** | Téléchargement hors-ligne haute vitesse (`X-Accel-Redirect`) avec gestionnaire local sur Mobile/Web | Jellyfin / Kyoo | **Natif (`expo-file-system`)** |
| **Live TV & IPTV** | Import de listes `.m3u` (GitHub / FAI) + Guide des programmes `XMLTV` (EPG en grille temporelle) | Jellyfin | **Natif (Proxy Hono + EAV)** |
| **Administration** | Gestion fine des utilisateurs, des permissions (RBAC) et contrôle parental par Tags/CSA (ABAC) | Jellyfin++ | **Natif** |
| **Réseau Social & Profil** | Favoris personnels avec filtrage immédiat (Films / Séries) et suppression optimiste | YouTube / Letterboxd | **Natif (`userFavoritesRoutes`)** |
| **Réseau Social & Profil** | Cercle d'amis, présence temps réel `isOnline`, statut de visionnage et bouton « Rejoindre ▶ » | Discord / Steam | **Natif (`presenceStore`)** |
| **Réseau Social & Profil** | Messagerie privée 1-on-1 déterministe (`dmTopicSlug`) sécurisée par amitié mutuelle | Discord | **Natif (`forumRoutes`)** |
| **Réseau Social & Profil** | Fil d'avis et micro-critiques avec étoiles (1-5), note moyenne et publication par upsert | Letterboxd / SensCritique | **Natif (`repostRoutes`)** |
| **Social & Watch Party** | Séances de visionnage partagé en direct (Watch Party) avec timeline synchronisée et heartbeat | Teleparty / Kyoo | **Natif (`sessionRoutes`)** |
| **Social & Watch Party** | Forum thématique et moteur d'associations quadri-dimensionnelles (Œuvres, Acteurs, Studios, Thèmes) | Reddit / Kyoo++ | **Natif (`forumAssociations`)** |
| **Social & Watch Party** | Salon d'appel vocal continu in-place (`LiveVoiceRoomBar`) découpé en tranches Opus 2.5s | Discord | **Natif (WebM/Opus)** |
| **Diffusion Sans Fil** | Détection et diffusion Google Cast & W3C Remote Playback avec barre de contrôle interactive | Jellyfin | **Natif (`castService`)** |
| **Mode Hors-Ligne & PWA** | PWA complète & Service Worker multi-couches (Cache-First images, SWR API) pour 0 ms et hors-ligne | Kyoo++ | **Natif (`sw.js`)** |
| **Embarquement & Partage** | Liens magiques d'invitation 1-clic (`/invite/:token`) pour messageries et auto-connexion | Sur-mesure | **Natif (`inviteRoutes`)** |

---

## 9. Infrastructure Conteneurisée Complète (`compose.yaml` & `Caddyfile`)

### 9.1. Fichier `compose.yaml` de Production
Rappel critique : Le dossier `/mnt/media_pool` est monté comme **un seul volume parent** dans `tmm`, `transcoder`, `api` et `gateway` pour garantir des déplacements atomiques instantanés (`mv` en $< 1\text{ ms}$) entre `/media/chaos` et `/media/clean`.

```yaml
name: universal-media-stack

services:
  # 1. BASE DE DONNÉES : POSTGRESQL 16 + POSTGIS + PG_TRGM
  postgres:
    image: postgis/postgis:16-3.4-alpine
    container_name: ums_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER:-ums}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-ums_secret}
      POSTGRES_DB: ${DB_NAME:-ums_db}
    volumes:
      - pg_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-ums} -d ${DB_NAME:-ums_db}"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - ums_net

  # 2. SANITARISATION, SCRAPING & ÉCRITURE NFO : TINYMEDIAMANAGER
  tmm:
    image: tinymediamanager/tinymediamanager:latest
    container_name: ums_tmm
    restart: unless-stopped
    environment:
      - USER_ID=1000
      - GROUP_ID=1000
      - TZ=Europe/Paris
      - ENABLE_HTTP_API=true
      - HTTP_API_PORT=7878
      - HTTP_API_KEY=${TMM_API_KEY:-tmm_secret_key}
    ports:
      - "4000:4000" # Accès UI Web (noVNC) pour supervision manuelle si besoin
    volumes:
      - ./config/tmm:/data
      - /mnt/media_pool:/media # Contient /media/chaos (entrée) et /media/clean (sortie)
    networks:
      - ums_net

  # 3. MOTEUR DE STREAMING & TRANSCODAGE MATÉRIEL (HLS / ASS SUBTITLES)
  transcoder:
    image: ghcr.io/zoriya/kyoo_transcoder:latest
    container_name: ums_transcoder
    restart: unless-stopped
    devices:
      - /dev/dri:/dev/dri # Passe-plat GPU Intel QuickSync / AMD VAAPI
    environment:
      - TRANSCODER_GOWORKERS=4
      - TRANSCODER_HWACCEL=${HWACCEL:-vaapi}
    volumes:
      - /mnt/media_pool/clean:/video:ro
      - transcoder_cache:/cache
    networks:
      - ums_net

  # 4. BACKEND API HONO + DRIZZLE + NFO WATCHER + IPTV WORKER + SEEDER
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    container_name: ums_api
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://${DB_USER:-ums}:${DB_PASSWORD:-ums_secret}@postgres:5432/${DB_NAME:-ums_db}
      - TRANSCODER_INTERNAL_URL=http://transcoder:7666
      - TMM_INTERNAL_URL=http://tmm:7878
      - TMM_API_KEY=${TMM_API_KEY:-tmm_secret_key}
      - MEDIA_CLEAN_ROOT=/media/clean
      - MEDIA_CHAOS_ROOT=/media/chaos
      - AUTO_SEED_KYOO_PRESET=true # Active l'interface Kyoo prête à l'emploi au 1er boot
      - SESSION_SECRET=${SESSION_SECRET:-super_secret_argon2_key}
    volumes:
      - /mnt/media_pool:/media # Accès lecture aux .nfo et écriture optionnelle si édition de tags depuis l'admin
    depends_on:
      postgres:
        condition: service_healthy
      transcoder:
        condition: service_started
    networks:
      - ums_net

  # 5. FRONTEND UNIVERSEL EXPO (SSR WEB + SERVEUR D'ASSETS)
  web:
    build:
      context: .
      dockerfile: apps/universal-app/Dockerfile
    container_name: ums_web
    restart: unless-stopped
    environment:
      - EXPO_PUBLIC_API_URL=/api
    depends_on:
      - api
    networks:
      - ums_net

  # 6. PASSERELLE CADDY (REVERSE PROXY + TELECHARGEMENT DIRECT X-ACCEL)
  gateway:
    image: caddy:2-alpine
    container_name: ums_gateway
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./config/Caddyfile:/etc/caddy/Caddyfile:ro
      - /mnt/media_pool/clean:/media/clean:ro # Lecture directe par Caddy pour les téléchargements et images
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - api
      - web
    networks:
      - ums_net

volumes:
  pg_data:
  transcoder_cache:
  caddy_data:
  caddy_config:

networks:
  ums_net:
    driver: bridge
```

### 9.2. Configuration `config/Caddyfile` (Streaming & Téléchargement Zéro-CPU)
Ce fichier permet à Hono de déléguer l'envoi des gros fichiers `.mkv` / `.mp4` et des images haute résolution directement au noyau Linux via Caddy :

```caddyfile
:80 {
    # 1. Routage de l'API Hono (RPC, Auth, Streaming HLS, Proxy IPTV)
    handle /api/* {
        reverse_proxy api:3000 {
            # Intercepte l'en-tête X-Accel-Redirect renvoyé par Hono après vérification RBAC
            @accel header X-Accel-Redirect *
            handle_response @accel {
                root * /media/clean
                rewrite * {rp.header.X-Accel-Redirect}
                method * GET
                # Active le support HTTP Range pour la lecture directe et les téléchargements repris
                file_server
            }
        }
    }

    # 2. Service direct ultra-rapide des Artworks locaux (poster.jpg, fanart.jpg, clearlogo.png)
    handle_path /artworks/* {
        root * /media/clean
        header Cache-Control "public, max-age=31536000, immutable"
        file_server
    }

    # 3. Interface Web Universelle Expo (SSR)
    handle /* {
        reverse_proxy web:8081
    }
}
```

---

## 10. Schéma de Base de Données Référence (`Drizzle ORM`)

Ce schéma (`packages/database/src/schema.ts`) est le cœur de votre **Universal Media Stack**. Il implémente l'arbre récursif, le système EAV sans perte, la machine à états, PostGIS, l'index de recherche floue, l'IPTV et le Server-Driven UI :

```typescript
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  doublePrecision,
  index,
  uniqueIndex,
  pgEnum,
  AnyPgColumn,
  customType,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// --- TYPE SPATIAL POSTGIS ---
const geometryPoint = customType<{ data: { lat: number; lng: number } }>({
  dataType() {
    return 'geometry(Point, 4326)';
  },
});

// --- ENUMS ---
export const nodeTypeEnum = pgEnum('node_type', [
  'COLLECTION',   // Saga / Franchise
  'SHOW',         // Série TV / Anime
  'SEASON',       // Saison ou Arc narratif
  'MOVIE',        // Film unitaire
  'EPISODE',      // Épisode
  'EXTRA',        // Bonus / OAV / Trailer local
  'LIVE_CHANNEL', // Chaîne TV en direct (IPTV M3U)
]);

export const nodeStateEnum = pgEnum('node_state', [
  'DISCOVERED',
  'PARSING_NFO',
  'READY',
  'MISSING_FILE',
  'ERROR',
]);

export const tagZoneEnum = pgEnum('tag_zone', [
  'HERO_BADGE',       // Affiché sous le titre principal (ex: CSA, 4K, HDR, Année)
  'PRIMARY_PILL',     // Pilules cliquables sous le synopsis (ex: Genres, Sujets)
  'PERSON_CAROUSEL',  // Carrousel avec photo et rôle (ex: Réalisateur, Acteurs)
  'TECHNICAL_DRAWER', // Tiroir technique (ex: Codecs, Bitrate, Langues, Custom XML)
  'HIDDEN_SEARCHABLE',// Non affiché mais interrogeable dans la barre de recherche
]);

export const railTypeEnum = pgEnum('rail_type', [
  'HERO_SPOTLIGHT',
  'CONTINUE_WATCHING',
  'RECENTLY_ADDED',
  'LIVE_TV_GRID',
  'COLLECTIONS_ROW',
  'DYNAMIC_TAG_QUERY',
  'SPATIAL_NEARBY',
]);

// ============================================================================
// 1. ARBRE RÉCURSIF DES MÉDIAS (VOD & LIVE IPTV) + RECHERCHE FLOUE + POSTGIS
// ============================================================================
export const mediaNodes = pgTable(
  'media_nodes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    parentId: uuid('parent_id').references((): AnyPgColumn => mediaNodes.id, {
      onDelete: 'cascade',
    }),
    nodeType: nodeTypeEnum('node_type').notNull(),
    state: nodeStateEnum('state').default('DISCOVERED').notNull(),

    // Identité & Titres
    title: text('title').notNull(),
    originalTitle: text('original_title'),
    sortTitle: text('sort_title').notNull(),
    slug: text('slug').notNull().unique(),
    tagline: text('tagline'),
    overview: text('overview'),

    // Ordre dans le parent (Numéro de saison, numéro d'épisode, ordre absolu ou numéro de chaîne TV)
    orderIndex: integer('order_index').default(0).notNull(),
    absoluteOrderIndex: integer('absolute_order_index'),

    // Références Fichiers Physiques (Source de Vérité File-Based) ou Flux IPTV
    videoFilePath: text('video_file_path'),
    nfoFilePath: text('nfo_file_path'),
    nfoSha256: text('nfo_sha256'),
    streamUrl: text('stream_url'), // Utilisé pour les chaînes IPTV .m3u8/.ts

    // Artworks locaux relatifs à /media/clean (ou URL logo IPTV)
    posterPath: text('poster_path'),
    fanartPath: text('fanart_path'),
    clearlogoPath: text('clearlogo_path'),
    thumbPath: text('thumb_path'),

    // Métadonnées numériques rapides pour le tri
    releaseYear: integer('release_year'),
    premieredDate: timestamp('premiered_date'),
    runtimeSeconds: integer('runtime_seconds'),
    communityRating: doublePrecision('community_rating'), // Note TMDB/IMDb

    // Chapitres extraits du NFO/MKV (pour Skip Intro / Skip Credits)
    chaptersJson: jsonb('chapters_json').$type<
      Array<{ title: string; startSeconds: number; endSeconds: number; type?: 'INTRO' | 'OUTRO' | 'NORMAL' }>
    >().default([]),

    // Géolocalisation PostGIS (Lieu de l'œuvre ou origine régionale de la chaîne TV)
    location: geometryPoint('location'),

    // Vecteur texte dénormalisé pour la recherche floue pg_trgm (< 10ms)
    // Contient : Titre + Titre Original + Acteurs + Rôles + Réalisateurs + Tous les Tags EAV
    searchVectorText: text('search_vector_text').default('').notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    parentIdx: index('idx_media_nodes_parent').on(table.parentId),
    typeIdx: index('idx_media_nodes_type').on(table.nodeType),
    nfoPathIdx: uniqueIndex('idx_media_nodes_nfo_path').on(table.nfoFilePath),
    // Index GIN Trigram pour la tolérance aux fautes de frappe
    trgmSearchIdx: index('idx_media_nodes_trgm_search').using(
      'gin',
      sql`${table.searchVectorText} gin_trgm_ops`
    ),
    // Index Spatial GIST PostGIS
    spatialIdx: index('idx_media_nodes_spatial').using('gist', table.location),
  })
);

// ============================================================================
// 2. MODÈLE POLYMORPHIQUE EAV (LES TAGS KYOO & CONFIG SERVER-DRIVEN UI)
// ============================================================================
export const eavAttributes = pgTable('eav_attributes', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Code unique du groupe (ex: 'certification', 'genre', 'subject', 'actor', 'director', 'video_quality', 'custom_edition')
  code: text('code').notNull().unique(),
  displayName: text('display_name').notNull(), // ex: "Classification CSA", "Sujets", "Qualité Vidéo"
  
  // Contrôle Server-Driven UI (Modifiable depuis le Back-Office Admin)
  uiZone: tagZoneEnum('ui_zone').default('PRIMARY_PILL').notNull(),
  displayOrder: integer('display_order').default(100).notNull(),
  iconName: text('icon_name').default('Tag').notNull(),
  colorTheme: text('color_theme').default('slate').notNull(), // ex: 'emerald', 'amber', 'rose', 'indigo'
  isFilterable: boolean('is_filterable').default(true).notNull(),
  isDynamicCatchAll: boolean('is_dynamic_catch_all').default(false).notNull(),
});

export const eavValues = pgTable(
  'eav_values',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    attributeId: uuid('attribute_id')
      .references(() => eavAttributes.id, { onDelete: 'cascade' })
      .notNull(),
    valueText: text('value_text').notNull(), // ex: "CSA : -12", "Vincent Cassel", "4K UHD", "Cyberpunk"
    valueSlug: text('value_slug').notNull(),
    // Métadonnées enrichies du tag (ex: Photo de l'acteur, TMDB Person ID, ou sévérité numérique CSA: 12, 16, 18)
    metadataJson: jsonb('metadata_json').$type<{
      thumbUrl?: string;
      externalId?: string;
      numericRank?: number;
      badgeColorOverride?: string;
    }>().default({}),
  },
  (table) => ({
    attrValueUnique: uniqueIndex('idx_eav_attr_val_unique').on(table.attributeId, table.valueSlug),
    trgmValIdx: index('idx_eav_values_trgm').using('gin', sql`${table.valueText} gin_trgm_ops`),
  })
);

export const nodeEavLinks = pgTable(
  'node_eav_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    nodeId: uuid('node_id')
      .references(() => mediaNodes.id, { onDelete: 'cascade' })
      .notNull(),
    valueId: uuid('value_id')
      .references(() => eavValues.id, { onDelete: 'cascade' })
      .notNull(),
    // Contexte spécifique au lien (ex: Le nom du personnage joué par l'acteur dans CE film : "Vinz")
    contextRole: text('context_role'),
    orderIndex: integer('order_index').default(0).notNull(),
  },
  (table) => ({
    nodeValIdx: uniqueIndex('idx_node_val_role').on(table.nodeId, table.valueId, table.contextRole),
    valueLookupIdx: index('idx_node_eav_by_value').on(table.valueId, table.nodeId),
  })
);

// ============================================================================
// 3. SERVER-DRIVEN UI : CONSTRUCTEUR DE RAILS D'ACCUEIL & PAGES
// ============================================================================
export const uiRails = pgTable('ui_rails', {
  id: uuid('id').defaultRandom().primaryKey(),
  pageTarget: text('page_target').default('HOME').notNull(), // 'HOME', 'MOVIES', 'SHOWS', 'LIVE_TV'
  title: text('title').notNull(),
  railType: railTypeEnum('rail_type').notNull(),
  cardStyle: text('card_style').default('POSTER_VERTICAL').notNull(), // 'POSTER_VERTICAL', 'LANDSCAPE', 'HERO', 'LIVE_CARD'
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),

  // Requête dynamique basée sur les Tags EAV pour alimenter automatiquement le rail
  queryConfigJson: jsonb('query_config_json').$type<{
    includeTagSlugsAll?: string[]; // AND
    includeTagSlugsAny?: string[]; // OR
    excludeTagSlugs?: string[];    // NOT
    nodeTypes?: Array<'MOVIE' | 'SHOW' | 'COLLECTION' | 'LIVE_CHANNEL'>;
    sortBy?: 'RELEASE_DATE_DESC' | 'ADDED_DATE_DESC' | 'RATING_DESC' | 'RANDOM';
    limit?: number;
  }>().default({}),
});

// ============================================================================
// 4. UTILISATEURS, RBAC & CONTRÔLE PARENTAL PAR TAGS (ABAC)
// ============================================================================
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  pinHash: text('pin_hash'), // Argon2 hash pour verrouillage de profil

  // Permissions Fonctionnelles (RBAC)
  isAdmin: boolean('is_admin').default(false).notNull(),
  canDownload: boolean('can_download').default(true).notNull(),
  canTranscode: boolean('can_transcode').default(true).notNull(),
  canWatchIptv: boolean('can_watch_iptv').default(true).notNull(),
  maxConcurrentStreams: integer('max_concurrent_streams').default(3).notNull(),

  // Contrôle d'Accès par Tags (ABAC / Contrôle Parental)
  maxCsaAgeLimit: integer('max_csa_age_limit'), // ex: 12 bloque automatiquement -16 et -18
  allowedValueIds: jsonb('allowed_value_ids').$type<string[]>().default([]), // Whitelist d'IDs EAV
  blockedValueIds: jsonb('blocked_value_ids').$type<string[]>().default([]), // Blacklist d'IDs EAV
  allowedTags: jsonb('allowed_tags').$type<string[]>().default([]), // Whitelist de libellés de tags
  blockedTags: jsonb('blocked_tags').$type<string[]>().default([]), // Blacklist de libellés de tags

  // Contrôle d'Accès par Dossiers Physiques (PBAC - Path-Based Access Control)
  allowedFolders: jsonb('allowed_folders').$type<string[]>().default([]), // Répertoires physiques autorisés
  blockedFolders: jsonb('blocked_folders').$type<string[]>().default([]), // Répertoires physiques interdits

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const watchProgress = pgTable(
  'watch_progress',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    nodeId: uuid('node_id').references(() => mediaNodes.id, { onDelete: 'cascade' }).notNull(),
    positionSeconds: doublePrecision('position_seconds').default(0).notNull(),
    durationSeconds: doublePrecision('duration_seconds').default(0).notNull(),
    isCompleted: boolean('is_completed').default(false).notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userNodeUnique: uniqueIndex('idx_progress_user_node').on(table.userId, table.nodeId),
  })
);

// ============================================================================
// 5. MOTEUR LIVE IPTV (.M3U) & GUIDE DES PROGRAMMES (XMLTV EPG)
// ============================================================================
export const iptvSources = pgTable('iptv_sources', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(), // ex: "GitHub IPTV France", "Freebox TV"
  m3uUrl: text('m3u_url').notNull(),
  epgXmltvUrl: text('epg_xmltv_url'),
  refreshIntervalHours: integer('refresh_interval_hours').default(6).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  userAgent: text('user_agent').default('UniversalMediaStack/3.0'),
  lastSyncedAt: timestamp('last_synced_at'),
});

export const epgPrograms = pgTable(
  'epg_programs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    channelNodeId: uuid('channel_node_id')
      .references(() => mediaNodes.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    subtitle: text('subtitle'),
    description: text('description'),
    category: text('category'),
    thumbnailUrl: text('thumbnail_url'),
    startTime: timestamp('start_time').notNull(),
    endTime: timestamp('end_time').notNull(),
  },
  (table) => ({
    channelTimeIdx: index('idx_epg_channel_time').on(table.channelNodeId, table.startTime, table.endTime),
  })
);

// ============================================================================
// 6. RÉSEAU SOCIAL, AMIS, FAVORIS & AVIS (social.ts)
// ============================================================================
export const userFavorites = pgTable(
  'user_favorites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    nodeId: uuid('node_id').references(() => mediaNodes.id, { onDelete: 'cascade' }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userNodeFavUnique: uniqueIndex('idx_favorites_user_node').on(table.userId, table.nodeId),
  })
);

export const userFriends = pgTable(
  'user_friends',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    friendId: uuid('friend_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    status: text('status').default('PENDING').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userFriendUnique: uniqueIndex('idx_friends_user_friend').on(table.userId, table.friendId),
  })
);

export const mediaReposts = pgTable(
  'media_reposts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    nodeId: uuid('node_id').references(() => mediaNodes.id, { onDelete: 'cascade' }).notNull(),
    rating: integer('rating'), // Note 1 à 5 étoiles
    comment: text('comment'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userNodeRepostUnique: uniqueIndex('idx_reposts_user_node').on(table.userId, table.nodeId),
  })
);

// ============================================================================
// 7. SÉANCES WATCH PARTY & SALONS SYNCHRONISÉS (sessions.ts)
// ============================================================================
export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  mediaId: uuid('media_id').references(() => mediaNodes.id, { onDelete: 'cascade' }).notNull(),
  hostUserId: uuid('host_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  status: text('status').default('ACTIVE').notNull(),
  currentPosition: doublePrecision('current_position').default(0).notNull(),
  isPublic: boolean('is_public').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sessionParticipants = pgTable('session_participants', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
});

// ============================================================================
// 8. FORUMS CULTURELS & SALONS PRIVÉS (forum.ts)
// ============================================================================
export const forumTopics = pgTable('forum_topics', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  isPrivate: boolean('is_private').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const forumMessages = pgTable('forum_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  topicId: uuid('topic_id').references(() => forumTopics.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  content: text('content').notNull(),
  mediaUrl: text('media_url'),
  mediaType: text('media_type'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// 9. INVITATIONS MAGIQUES 1-CLIC (invitations.ts)
// ============================================================================
export const userInvitations = pgTable('user_invitations', {
  id: uuid('id').defaultRandom().primaryKey(),
  token: text('token').notNull().unique(),
  displayName: text('display_name').notNull(),
  profileRole: text('profile_role').default('STANDARD').notNull(),
  defaultUsername: text('default_username'),
  initialPassword: text('initial_password'),
  isUsed: boolean('is_used').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
});
```

---

## 11. Master Prompt : Cahier des Charges pour l'Agent IA Autonome

Copiez et donnez l'intégralité du bloc ci-dessous comme instruction maîtresse (`PROMPT.md` ou `CLAUDE.md`) à votre agent IA autonome de développement. Il est structuré pour qu'il construise l'intégralité du projet sans poser de questions bloquantes et en respectant chaque détail de votre vision.

```markdown
# AUTONOMOUS AGENT DIRECTIVE: BUILD "THE UNIVERSAL MEDIA STACK"

## 1. PROJECT IDENTITY & GOAL
You are an elite Principal Full-Stack TypeScript Engineer. Your task is to build a complete, production-ready, self-hosted Media Platform that merges **Kyoo's cinema-grade, tag-centric UI** with **Jellyfin's advanced backend features** (Live IPTV via M3U/XMLTV, granular RBAC/ABAC, and a Server-Driven UI Admin Builder).

You are building on **The Universal Stack**:
- **Monorepo:** Bun workspaces + Turborepo (`packages/database`, `packages/shared-types`, `apps/api`, `apps/universal-app`).
- **Frontend:** Expo + React Native + Expo Router (Universal Web SSR, iOS, Android, TV) using `expo-video`, `expo-file-system`, and Tailwind/NativeWind.
- **Backend:** Hono (TypeScript) on Bun with end-to-end Hono RPC typing.
- **Database:** PostgreSQL 16 + PostGIS + `pg_trgm` + `unaccent` via **Drizzle ORM**.
- **External Containers:** `tinyMediaManager` (curation, renaming, `.nfo` generation), `kyoo_transcoder` (hardware-accelerated HLS & subtitle extraction), and `Caddy` (`X-Accel-Redirect` zero-CPU downloads & artwork serving).

---

## 2. CRITICAL REQUIREMENT: "ZERO-CONFIG DAY 1, INFINITE-CONFIG DAY 2"
When the application boots for the very first time (`AUTO_SEED_KYOO_PRESET=true`), the user MUST NOT face an empty or unconfigured interface.
1. **Automatic Kyoo Seeder (`apps/api/src/seed/kyoo-preset.ts`):**
   - On server startup, automatically seed `eav_attributes` with a beautiful, pre-ordered hierarchy of tag groups:
     - `HERO_BADGE` (Order 1-5): `certification` (CSA ratings with color severity), `release_year`, `video_quality` (4K, HDR10, Dolby Vision, HEVC), `audio_language` (VF, VOSTFR, Multi), `community_rating`.
     - `PRIMARY_PILL` (Order 6-10): `genre`, `subject` (all `<tag>` keywords from NFO), `studio`, `country`, `iptv_category`.
     - `PERSON_CAROUSEL` (Order 11-13): `director`, `writer`, `actor` (with character role & local/TMDB thumb).
     - `TECHNICAL_DRAWER` (Order 14+): `video_codec`, `audio_codec`, `subtitle_language`, `external_id`, and all `custom_*` dynamic XML tags.
   - Automatically seed `ui_rails` for the Home Page so it looks exactly like a polished Kyoo instance out of the box:
     1. *Hero Spotlight* (`HERO_SPOTLIGHT`)
     2. *Reprendre la lecture* (`CONTINUE_WATCHING`)
     3. *Ajouts Récents* (`RECENTLY_ADDED`)
     4. *Télévision en Direct* (`LIVE_TV_GRID` — auto-hidden if 0 channels exist)
     5. *Sagas & Collections* (`COLLECTIONS_ROW`)
     6. *Cinéma 4K & HDR* (`DYNAMIC_TAG_QUERY` filtering `4K` or `HDR10`)
     7. *Exploration par Genres & Sujets* (`DYNAMIC_TAG_QUERY`)
2. **Backend-Driven Modularity:** Every single one of those seeded rails and tag groups MUST be dynamically fetched from Hono (`GET /api/ui/layout`) and fully editable/reorderable via Drag-and-Drop in the Admin Dashboard (`/admin/layout` & `/admin/tags`).

---

## 3. CORE ENGINEERING MODULES TO IMPLEMENT

### Module A: Zero-Loss NFO Watcher & Ingestion (`apps/api/src/watcher`)
1. Use `chokidar` to watch `MEDIA_CLEAN_ROOT` for `.nfo` files (`movie.nfo`, `tvshow.nfo`, `<episode>.nfo`).
2. Parse the XML using `fast-xml-parser`.
3. **100% Data Preservation Rule:** Map all known XML tags to their respective `eav_attributes`. For ANY remaining or unknown XML tag present in the `.nfo`, automatically upsert an attribute with `code = 'custom_' + tagName` and `uiZone = 'TECHNICAL_DRAWER'`, and link its value in `eav_values` and `node_eav_links`. Zero data from the `.nfo` may ever be discarded.
4. Build the recursive hierarchy in `media_nodes` (`COLLECTION` -> `SHOW` -> `SEASON` -> `EPISODE` or `MOVIE`) and extract `<fileinfo><streamdetails>` + chapters (`INTRO`/`OUTRO` timestamps).
5. Rebuild the denormalized `search_vector_text` column on `media_nodes` (concatenating unaccented title, original title, people names, character roles, and all linked EAV tag values).

### Module B: Typo-Tolerant Instant Search (`apps/api/src/routes/search.ts`)
1. Enable PostgreSQL extensions `CREATE EXTENSION IF NOT EXISTS pg_trgm;` and `CREATE EXTENSION IF NOT EXISTS unaccent;` in the Drizzle migration.
2. Implement `GET /api/search?q=...` using `pg_trgm` (`word_similarity` and `similarity` operators `%>` and `%`) against `media_nodes.search_vector_text` and `eav_values.value_text`.
3. Return categorized results in $< 10\text{ ms}$: matching Media Nodes (Movies/Shows/Episodes), Live TV Channels, People (Actors/Directors with avatar), and clickable EAV Tag Pills.

### Module C: Live IPTV M3U & XMLTV Engine (`apps/api/src/iptv`)
1. Build an M3U8/M3U playlist parser and XMLTV EPG parser (`POST /api/admin/iptv/sources` & background cron refresh).
2. Convert every `#EXTINF` channel into a `media_node` with `nodeType = 'LIVE_CHANNEL'`, storing `group-title`, `tvg-country`, and `tvg-language` as EAV tags so channels integrate seamlessly into the global tag system and search bar.
3. Build the CORS & Remux Proxy route (`GET /api/iptv/stream/:nodeId/live.m3u8`):
   - Validate user permission (`canWatchIptv` + ABAC tag rules).
   - Proxy HLS `.m3u8` manifests and rewrite segment URLs through Hono, or spawn an on-the-fly FFmpeg HLS remuxer if the source stream is raw MPEG-TS (`.ts`).

### Module D: RBAC & Tag-Based Parental Control Middleware (`apps/api/src/middleware/access.ts`)
1. Implement passwordless session auth (Magic Links + 4-digit Profile PIN + TV Quick-Connect code) with Argon2 and HttpOnly cookies.
2. Create a Drizzle query guard `withUserAccessFilter(user)` applied to ALL catalog, search, rail, stream, and download queries:
   - Exclude any `media_node` linked to an `eav_value` in `user.blockedValueIds`.
   - If `user.maxCsaAgeLimit` is set (e.g., `12`), automatically exclude nodes tagged with `CSA : -16` or `CSA : -18`.
   - If `user.allowedValueIds` is non-empty, restrict results strictly to nodes matching those tags.

### Module E: Universal Kyoo-Style Frontend & Admin Studio (`apps/universal-app`)
1. **Home & Browse Screens (`app/(tabs)/index.tsx`, `explore.tsx`):**
   - Render the Server-Driven UI rails dynamically.
   - Provide a multi-facet filter bar on `/explore` allowing users to combine multiple tags (e.g., `CSA: -12` + `Subject: Dystopie` + `4K`), sort results, or filter spatially on a PostGIS map view.
2. **Media Detail Screen (`app/media/[slug].tsx`):**
   - Full-bleed Fanart backdrop with gradient fade, ClearLogo overlay, and dynamic rendering of `HERO_BADGE`, `PRIMARY_PILL`, `PERSON_CAROUSEL`, and `TECHNICAL_DRAWER` according to `eav_attributes.displayOrder`.
   - For Shows/Collections: Season selector, Episode cards with thumbnails, progress bars, and "Download Season" button.
3. **Live TV & EPG Screen (`app/(tabs)/live.tsx`):**
   - Interactive horizontal EPG timeline grid showing live and upcoming broadcasts from `epg_programs`, category filter pills (`Sport`, `Cinéma`, `Info`), and 1-click instant playback in the browser or mobile app.
4. **Universal Video Player (`app/player/[id].tsx`):**
   - Powered by `expo-video` with custom Kyoo-style overlay: quality/transcode selector, audio track switcher, `.ass`/`.srt` subtitle switcher, chapter markers, floating **"Skip Intro / Skip Credits"** button, and 10-second progress heartbeat sync.
5. **Admin Back-Office (`app/admin/*`):**
   - **UI & Rail Builder (`/admin/layout`):** Reorder home rails, create custom tag-query rails, and change card styles.
   - **Tag Manager (`/admin/tags`):** Reorder tag groups, change badge zones (`HERO_BADGE` vs `PRIMARY_PILL`), customize colors, and inspect all auto-discovered `.nfo` tags.
   - **IPTV Manager (`/admin/iptv`):** Add/refresh GitHub or custom `.m3u` & `XMLTV` URLs.
   - **User & RBAC Manager (`/admin/users`):** Manage permissions (`canDownload`, `canTranscode`, `canWatchIptv`) and parental control tag restrictions.

### Module F: Social, Watch Party & Discussion Hub (`apps/api/src/routes/sessionRoutes.ts`, `apps/api/src/routes/repostFeedRoutes.ts`, `apps/api/src/routes/friendActionRoutes.ts`)
1. Implement personal favorites with category filtering (`userFavoritesRoutes`).
2. Build bidirectional friends system with real-time `isOnline` presence, watching status detection (`currentActivity`), and deterministic 1-on-1 DM slugs (`dm-${[u1, u2].sort().join('-')}`).
3. Implement live Watch Party sessions with heartbeat, synchronized position, host controls, and automatic abandonment cleanup.
4. Implement reviews and reposts with 1-5 star ratings, community average calculation, and idempotent upserts.
5. Build contextual forum topics with 4D graph associations (Related Works, People, Studios, Genres/Countries) and in-place voice calls (`LiveVoiceRoomBar`).

### Module G: Google Cast, Offline PWA & Magic Invitations (`frontend/src/services/castService.ts`, `frontend/public/sw.js`, `apps/api/src/routes/inviteRoutes.ts`)
1. Integrate W3C Remote Playback and Google Cast SDK with synchronized playback control bar.
2. Build multi-layer Service Worker (`sw.js`) with Cache-First strategy for images/artworks, Stale-While-Revalidate for API responses, and graceful offline fallback.
3. Build 1-click magic invite links (`/invite/:token`) with social preview meta tags (Open Graph) and 0ms auto-login via localStorage.

---

## 4. EXECUTION ORDER
Start immediately by scaffolding the Turborepo structure, writing the complete Drizzle schema (`packages/database`), implementing the `kyoo-preset.ts` auto-seeder, and building the Zero-Loss `.nfo` Watcher and `.m3u` IPTV parser before wiring the Hono RPC endpoints and Expo Router screens. Ensure strict TypeScript compilation (`tsc --noEmit`) across all packages.